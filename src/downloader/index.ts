import { config } from "../config.js";
import { spawn } from "node:child_process";
import path from "node:path";
import { addToCache, isCached } from "../cache.js";
import type { RegularCodecType, WebplaybackCodecType } from "./codecType.js";
import type { GetSongResponse } from "../appleMusicApi/types/responses.js";
import { FileMetadata } from "./fileMetadata.js";

export async function downloadSong(streamUrl: string, decryptionKey: string, songCodec: RegularCodecType | WebplaybackCodecType, songResponse: GetSongResponse<["extendedAssetUrls"], ["albums"]>): Promise<string> {
    let baseOutputName = streamUrl.match(/(?:.*\/)\s*(\S*?)[.?]/)?.[1];
    if (!baseOutputName) { throw new Error("could not get base output name from stream url!"); }
    baseOutputName += `_${songCodec}`;
    const encryptedName = baseOutputName + "_enc.mp4";
    const encryptedPath = path.join(config.downloader.cache.directory, encryptedName);
    const decryptedName = baseOutputName + ".mp4";
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
