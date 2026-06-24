import { getWidevineDecryptionKey } from "../../../downloader/keygen.js";
import { downloadSongFile } from "../../../downloader/index.js";
import express from "express";
import StreamInfo from "../../../downloader/streamInfo.js";
import { appleMusicApi } from "../../../appleMusicApi/index.js";
import { z } from "zod";
import { validate } from "../../validate.js";
import { CodecType, regularCodecTypeSchema, webplaybackCodecTypeSchema, type RegularCodecType, type WebplaybackCodecType } from "../../../downloader/codecType.js";
import { paths } from "../../openApi.js";
import { formatSongForFs } from "../../../downloader/format.js";
import { addKeyToCache, getKeyFromCache } from "../../../cache.js";
import { apiAuthentication } from "../../../appleMusicApi/auth.js";

const router = express.Router();

const path = "/download";
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
            200: { description: "returns a song in an mp4 container" },
            400: { description: "bad request, invalid query parameters. sent as a zod error with details" },
            default: { description: "upstream api error, or some other error" }
        }
    }
};

// TODO: support more encryption schemes
// TODO: some type of agnostic-ness for the encryption schemes on regular codec
// TODO: now that i think about it.. there gotta be an easier way for the codec type stuff im cryin, like look in dl segment too
router.get(path, async (req, res, next) => {
    try {
        const { id, codec } = (await validate(req, schema)).query;
        const auth = (await validate(req, schema)).cookies;

        const codecType = new CodecType(codec);

        const trackMetadata = await appleMusicApi.getSong(id, auth);
        const trackAttributes = trackMetadata.data[0].attributes;
        const streamInfo = await (codecType.regularOrWebplayback === "regular"
            ? StreamInfo.fromTrackMetadata(trackAttributes, codecType.codecType as RegularCodecType)
            : StreamInfo.fromWebplayback(await appleMusicApi.getWebplayback(id), codecType.codecType as WebplaybackCodecType)
        );

        if (streamInfo.widevinePssh === undefined) {
            if (codecType.regularOrWebplayback === "regular") { throw new Error("failed to get widevine pssh, this is typical"); }
            else { throw new Error("failed to get widevine pssh for web playback, this should not happen.."); }
        }

        const decryptionKey =
            await getKeyFromCache(id, codecType.codecType) ??
            await getWidevineDecryptionKey(streamInfo.widevinePssh, streamInfo.trackId, auth);
        await addKeyToCache(id, codecType.codecType, decryptionKey);

        const downloadedSong = await downloadSongFile(streamInfo.streamUrl, decryptionKey, codecType.codecType, trackMetadata);

        // TODO: this can be wrong sometimes. completely hardcoded
        // no clue what i'll do about that in the future
        // for now its fine :D
        const fileExt = ".m4a";
        const fileName = formatSongForFs(trackAttributes) + fileExt;
        res.attachment(fileName);
        res.sendFile(downloadedSong, { root: "." });
    } catch (err) {
        next(err);
    }
});

export default router;
