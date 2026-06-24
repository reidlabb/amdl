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
import { apiAuthentication } from "../../../appleMusicApi/auth.js";

const router = express.Router();

const path = "/downloadAlbum";
const schema = z.object({
    query: z.object({
        id: z.string(),
        codec: z.enum([...regularCodecTypeSchema.options, ...webplaybackCodecTypeSchema.options])
    }),
    cookies: apiAuthentication.optional()
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

router.get(path, async (req, res, next) => {
    try {
        const { id, codec } = (await validate(req, schema)).query;
        const auth = (await validate(req, schema)).cookies;

        const albumMetadata = await appleMusicApi.getAlbum(id, auth);
        const albumAttributes = albumMetadata.data[0].attributes;
        const tracks = albumMetadata.data[0].relationships.tracks.data;

        const fileName = formatAlbumForFs(albumAttributes) + ".zip";
        res.attachment(fileName);

        const zipArchiver = archiver("zip");
        zipArchiver.pipe(res);
        zipArchiver.on("error", (err) => { throw err; });
        zipArchiver.on("warning", (err) => { throw err; });

        for (const track of tracks) {
            const trackId = track.attributes.playParams?.id;
            if (trackId === undefined) { throw new Error("track id gone, this may indicate your song isn't accessable w/ your subscription!"); }

            const codecType = new CodecType(codec);

            const trackMetadata = await appleMusicApi.getSong(trackId, auth);
            const trackAttributes = trackMetadata.data[0].attributes;
            const streamInfo = await (codecType.regularOrWebplayback === "regular"
                ? StreamInfo.fromTrackMetadata(trackAttributes, codecType.codecType as RegularCodecType)
                : StreamInfo.fromWebplayback(await appleMusicApi.getWebplayback(trackId, auth), codecType.codecType as WebplaybackCodecType)
            );

            if (streamInfo.widevinePssh === undefined) {
                if (codecType.regularOrWebplayback === "regular") { throw new Error("failed to get widevine pssh, this is typical"); }
                else { throw new Error("failed to get widevine pssh for web playback, this should not happen.."); }
            }

            const decryptionKey =
                await getKeyFromCache(trackId, codecType.codecType) ??
                await getWidevineDecryptionKey(streamInfo.widevinePssh, streamInfo.trackId, auth);
            await addKeyToCache(trackId, codecType.codecType, decryptionKey);

            const downloadedSong = await downloadSongFile(streamInfo.streamUrl, decryptionKey, codecType.codecType, trackMetadata);

            // TODO: this can be wrong sometimes. completely hardcoded
            // no clue what i'll do about that in the future
            // for now its fine :D
            const fileExt = ".m4a";
            const fileName = formatSongForFs(trackAttributes) + fileExt;
            zipArchiver.file(downloadedSong, { name: fileName });
        }

        const albumCover = await downloadAlbumCover(albumAttributes);
        const albumCoverExt = albumCover.slice(albumCover.lastIndexOf(".") + 1);
        zipArchiver.file(albumCover, { name: `cover.${albumCoverExt}` });
        zipArchiver.finalize();
    } catch (err) {
        next(err);
    }
});

export default router;
