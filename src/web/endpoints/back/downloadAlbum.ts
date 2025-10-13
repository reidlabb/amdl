import express from "express";
import { paths } from "../../openApi.js";
import { CodecType, regularCodecTypeSchema, webplaybackCodecTypeSchema, type RegularCodecType, type WebplaybackCodecType } from "../../../downloader/codecType.js";
import z from "zod";
import { validate } from "../../validate.js";
import StreamInfo from "../../../downloader/streamInfo.js";
import { appleMusicApi } from "../../../appleMusicApi/index.js";
import { getWidevineDecryptionKey } from "../../../downloader/keygen.js";
import { downloadAlbumCover, downloadSongFile } from "../../../downloader/index.js";
import { formatAlbumForFs, formatSongForFs } from "../../../downloader/format.js";
import archiver from "archiver";
import { addKeyToCache, getKeyFromCache } from "../../../cache.js";

const router = express.Router();

const path = "/downloadAlbum";
const schema = z.object({
    query: z.object({
        id: z.string(),
        codec: z.enum([...regularCodecTypeSchema.options, ...webplaybackCodecTypeSchema.options])
    })
});

paths[path] = {
    get: {
        requestParams: { query: schema.shape.query },
        responses: {
            200: { description: "returns an album in a zip" },
            400: { description: "bad request, invalid query parameters. sent as a zod error with details" },
            default: { description: "upstream api error, or some other error" }
        }
    }
};

interface AlbumEntry {
    path: string;
    name: string;
}

// TODO: include album art?
router.get(path, async (req, res, next) => {
    try {
        const { id, codec } = (await validate(req, schema)).query;

        const files: AlbumEntry[] = [];

        const albumMetadata = await appleMusicApi.getAlbum(id);
        const albumAttributes = albumMetadata.data[0].attributes;
        const tracks = albumMetadata.data[0].relationships.tracks.data;

        for (const track of tracks) {
            const trackId = track.attributes.playParams?.id;
            if (trackId === undefined) { throw new Error("track id gone, this may indicate your song isn't accessable w/ your subscription!"); }

            const codecType = new CodecType(codec);

            const trackMetadata = await appleMusicApi.getSong(trackId);
            const trackAttributes = trackMetadata.data[0].attributes;
            const streamInfo = await (codecType.regularOrWebplayback === "regular"
                ? StreamInfo.fromTrackMetadata(trackAttributes, codecType.codecType as RegularCodecType)
                : StreamInfo.fromWebplayback(await appleMusicApi.getWebplayback(trackId), codecType.codecType as WebplaybackCodecType)
            );

            if (streamInfo.widevinePssh === undefined) {
                if (codecType.regularOrWebplayback === "regular") { throw new Error("failed to get widevine pssh, this is typical"); }
                else { throw new Error("failed to get widevine pssh for web playback, this should not happen.."); }
            }

            const decryptionKey =
                await getKeyFromCache(trackId, codecType.codecType) ??
                await getWidevineDecryptionKey(streamInfo.widevinePssh, streamInfo.trackId);
            await addKeyToCache(trackId, codecType.codecType, decryptionKey);

            const filePath = await downloadSongFile(streamInfo.streamUrl, decryptionKey, codecType.codecType, trackMetadata);
            const fileExt = "." + filePath.split(".").at(-1) as string; // safe cast, filePath is always a valid path
            const fileName = formatSongForFs(trackAttributes) + fileExt;

            files.push({
                path: filePath,
                name: fileName
            });
        }

        const fileName = formatAlbumForFs(albumAttributes) + ".zip";
        const zipArchiver = archiver("zip");

        zipArchiver.on("error", (err) => { throw err; });
        zipArchiver.pipe(res);

        for (const file of files) {
            zipArchiver.file(file.path, { name: file.name });
        }

        const albumCover = await downloadAlbumCover(albumAttributes);
        const albumCoverExt = albumCover.slice(albumCover.lastIndexOf(".") + 1);
        zipArchiver.file(await downloadAlbumCover(albumAttributes), { name: `cover.${albumCoverExt}` });
        zipArchiver.finalize();

        res.attachment(fileName);
    } catch (err) {
        next(err);
    }
});

export default router;
