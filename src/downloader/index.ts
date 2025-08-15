import { config } from "../config.js";
import { spawn } from "node:child_process";
import path from "node:path";
import { addToCache, isCached } from "../cache.js";
import type { RegularCodecType, WebplaybackCodecType } from "./codecType.js";
import type { GetSongResponse } from "../appleMusicApi/types/responses.js";
import { FileMetadata } from "./fileMetadata.js";
import { createDecipheriv } from "node:crypto";
import * as log from "../log.js";

export async function downloadSongFile(streamUrl: string, decryptionKey: string, songCodec: RegularCodecType | WebplaybackCodecType, songResponse: GetSongResponse<[], ["albums"]>): Promise<string> {
    log.debug("downloading song file and hopefully decrypting it");
    log.debug({ streamUrl: streamUrl, songCodec: songCodec });

    let baseOutputName = streamUrl.match(/(?:.*\/)\s*(\S*?)[.?]/)?.[1];
    if (!baseOutputName) { throw new Error("could not get base output name from stream url!"); }
    baseOutputName += `_${songCodec}`;
    const encryptedName = baseOutputName + "_enc.mp4";
    const encryptedPath = path.join(config.downloader.cache.directory, encryptedName);
    const decryptedName = baseOutputName + ".m4a";
    const decryptedPath = path.join(config.downloader.cache.directory, decryptedName);

    if ( // TODO: remove check for encrypted file/cache for encrypted?
        isCached(encryptedName) &&
        isCached(decryptedName)
    ) { return decryptedPath; }

    await new Promise<void>((res, rej) => {
        const child = spawn(config.downloader.ytdlp_path, [
            "--quiet",
            "--no-warnings",
            "--allow-unplayable-formats",
            "--fixup", "never",
            "--paths", config.downloader.cache.directory,
            "--output", encryptedName,
            streamUrl
        ]);
        child.on("error", (err) => { rej(err); });
        child.stderr.on("data", (data) => { rej(new Error(data.toString().trim())); });
        child.on("exit", () => { res(); });
    });

    addToCache(encryptedName);

    const fileMetadata = FileMetadata.fromSongResponse(songResponse);

    await new Promise<void>(async (res, rej) => {
        const child = spawn(config.downloader.ffmpeg_path, [
            "-loglevel", "error",
            "-y",
            "-decryption_key", decryptionKey,
            ...await fileMetadata.setupFfmpegInputs(encryptedPath),
            ...await fileMetadata.toFfmpegArgs(),
            "-movflags", "+faststart",
            decryptedPath
        ]);
        child.on("error", (err) => { rej(err); });
        child.stderr.on("data", (data) => { rej(new Error(data.toString().trim())); });
        child.on("exit", () => { res(); } );
    });

    addToCache(decryptedName);

    return decryptedPath;
}

// here's where shit gets real...
// here's also where i regret using javascript
// TODO: less mem alloc/access
// TODO: use actual atom scanning. what if the magic bytes appear in a sample
export async function fetchAndDecryptStreamSegment(segmentUrl: string, decryptionKey: string, fetchLength: number, offset: number): Promise<Uint8Array> {
    log.debug("downloading and hopefully decrypting stream segment");
    log.debug({ segmentUrl: segmentUrl, offset: offset, fetchLength: fetchLength });

    const response = await fetch(segmentUrl, { headers: { "range": `bytes=${offset}-${offset + fetchLength - 1}` }});

    const file = new Uint8Array(await response.arrayBuffer());

    // this translates to "moof"
    const moof = new Uint8Array([0x6D, 0x6F, 0x6F, 0x66]);
    const moofIndex = file.findIndex((_v, i) => {
        return file.subarray(i, i + moof.length).every((byte, j) => { return byte === moof[j]; });
    });

    const ivs = await extractIvFromFile(file);
    const sampleLocs = await extractSampleLocationsFromFile(file);

    if (moofIndex !== -1) {
        sampleLocs.forEach((loc, i) => {
            const iv = ivs[i].value;
            const subsamples = ivs[i].subsamples;

            const sample = file.subarray( // minus 4 because size
                moofIndex + loc.offset - 4,
                moofIndex + loc.offset + loc.size - 4
            );

            if (subsamples.length > 0) {
                let pos = 0;

                const decipher = createDecipheriv("aes-128-ctr", Buffer.from(decryptionKey, "hex"), Buffer.concat([iv, Buffer.alloc(8)]));

                subsamples.forEach(({ clearBytes, encryptedBytes }) => {
                    pos += clearBytes;

                    if (encryptedBytes > 0) {
                        const chunk = sample.subarray(pos, pos + encryptedBytes);
                        const decryptedChunk = Buffer.concat([decipher.update(chunk), decipher.final()]);
                        decryptedChunk.copy(sample, pos);
                        pos += encryptedBytes;
                    }
                });
            } else {
                const decipher = createDecipheriv("aes-128-ctr", Buffer.from(decryptionKey, "hex"), Buffer.concat([iv, Buffer.alloc(8)]));
                const decrypted = Buffer.concat([decipher.update(sample), decipher.final()]);

                file.set(decrypted, moofIndex + loc.offset - 4);
            }
        });
    }

    return file;
}

interface IvValue {
    value: Buffer;
    subsamples: Subsample[];
}

interface Subsample {
    clearBytes: number;
    encryptedBytes: number;
}

async function extractIvFromFile(file: Uint8Array): Promise<IvValue[]> {
    const ivArray: IvValue[] = [];

    let maxSampleCount: number | undefined;
    let subsampleEncryptionPresent = false;

    for (let i = 0; i < file.length; i++) {
        // this translates to "senc"
        if (
            file[i] === 0x73 &&
            file[i+1] === 0x65 &&
            file[i+2] === 0x6E &&
            file[i+3] === 0x63
        ) {
            // skip 4 bytes -- skip "senc" header
            i += 4;

            // skip 1 byte -- skip version
            i += 1;

            const flags = (file[i] << 16) | (file[i+1] << 8) | file[i+2];

            subsampleEncryptionPresent = (flags & 0x000002) !== 0;

            // skip 4 bytes -- skip flags
            i += 3;

            // uint8x4 -> uint32x1
            maxSampleCount = (file[i] << 24) | (file[i+1] << 16) | (file[i+2] << 8) | file[i+3];

            // skip 4 bytes -- skip sample count
            i += 4;

            for (let sampleIndex = 0; sampleIndex < maxSampleCount; sampleIndex++) {
                const iv = file.subarray(i, i + 8);

                // skip 8 bytes -- skip iv
                i += 8;

                const subsamples: Subsample[] = [];
                if (subsampleEncryptionPresent) {
                    const subsampleCount = (file[i] << 8) | file[i+1];

                    // skip 2 bytes -- skip subsample count
                    i += 2;

                    for (let j = 0; j < subsampleCount; j++) {
                        const clearBytes = (file[i] << 8) | file[i+1];

                        // skip 2 bytes -- skip clear bytes
                        i += 2;

                        const encryptedBytes = (file[i] << 24) | (file[i+1] << 16) | (file[i+2] << 8) | file[i+3];

                        // skip 4 bytes -- skip encrypted bytes
                        i += 4;

                        subsamples.push({
                            clearBytes: clearBytes,
                            encryptedBytes: encryptedBytes
                        });
                    }
                }

                ivArray.push({
                    value: Buffer.from(iv),
                    subsamples: subsamples
                });
            }
        }
    }

    return ivArray;
}

interface SampleLocation {
    offset: number;
    size: number;
}

async function extractSampleLocationsFromFile(file: Uint8Array): Promise<SampleLocation[]> {
    const sampleLocations: SampleLocation[] = [];

    for (let i = 0; i < file.length; i++) {
        // this translates to "trun"
        if (
            file[i] === 0x74 &&
            file[i+1] === 0x72 &&
            file[i+2] === 0x75 &&
            file[i+3] === 0x6E
        ) {
            // skip 4 bytes -- skip "trun" header
            i += 4;

            // skip 1 byte -- skip version
            i += 1;

            const flags = (file[i] << 16) | (file[i+1] << 8) | file[i+2];

            const dataOffsetPresent = (flags & 0x000001) !== 0;
            const firstSampleFlagsPresent = (flags & 0x000004) !== 0;
            const sampleDurationPresent = (flags & 0x000100) !== 0;
            const sampleSizePresent = (flags & 0x000200) !== 0;
            const sampleFlagsPresent = (flags & 0x000400) !== 0;
            const sampleCompositionTimeOffsetsPresent = (flags & 0x000800) !== 0;

            // skip 3 bytes -- skip flags
            i += 3;

            if (!dataOffsetPresent) { throw new Error("data offset not present in trun atom!"); }
            if (!sampleSizePresent) { throw new Error("sample size not present in trun atom!"); }

            // TODO: add these flags
            if (firstSampleFlagsPresent) { throw new Error("first sample flags not supported yet!"); }
            if (sampleFlagsPresent) { throw new Error("sample flags not supported yet!"); }
            if (sampleCompositionTimeOffsetsPresent) { throw new Error("sample composition time offsets not supported yet!"); }

            const sampleCount = (file[i] << 24) | (file[i+1] << 16) | (file[i+2] << 8) | file[i+3];

            // skip 4 bytes -- skip sample count
            i += 4;

            let sampleDataOffset = (file[i] << 24) | (file[i+1] << 16) | (file[i+2] << 8) | file[i+3];

            // skip 4 bytes -- skip data offset
            i += 4;

            for (let j = 0; j < sampleCount; j++) {
                // honestly? i'm scared of what apple is doing to where this could be true
                // for context, only ones that use subsample encryption have this... on the last segment?????
                // truly something that you gotta ponder about for a second
                // skip 4 bytes -- skip sample duration
                if (sampleDurationPresent) { i += 4; }

                const sampleSize = (file[i] << 24) | (file[i+1] << 16) | (file[i+2] << 8) | file[i+3];

                // skip 4 bytes -- skip sample size
                i += 4;

                sampleLocations.push({ offset: sampleDataOffset, size: sampleSize });
                sampleDataOffset += sampleSize;
            }
        }
    }

    return sampleLocations;
}
