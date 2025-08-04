import { getWidevineDecryptionKey } from "../../../downloader/keygen.js";
import { downloadSong } from "../../../downloader/index.js";
import express from "express";
import StreamInfo from "../../../downloader/streamInfo.js";
import { appleMusicApi } from "../../../appleMusicApi/index.js";
import { z } from "zod";
import { validate } from "../../validate.js";
import { CodecType, regularCodecTypeSchema, webplaybackCodecTypeSchema, type RegularCodecType, type WebplaybackCodecType } from "../../../downloader/codecType.js";
import { paths } from "../../openApi.js";

const router = express.Router();

const path = "/download";
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
            200: { description: "returns a song in an mp4 container" },
            400: { description: "bad request, invalid query parameters. sent as a zod error with details" },
            default: { description: "upstream api error, or some other error" }
        }
    }
};

// TODO: support more encryption schemes
// TODO: some type of agnostic-ness for the encryption schemes on regular codec
router.get(path, async (req, res, next) => {
    try {
        const { id, codec } = (await validate(req, schema)).query;

        const codecType = new CodecType(codec);

        if (codecType.regularOrWebplayback === "regular") {
            const regularCodec = codecType.codecType as RegularCodecType; // safe cast, zod
            const trackMetadata = await appleMusicApi.getSong(id);
            const trackAttributes = trackMetadata.data[0].attributes;
            const streamInfo = await StreamInfo.fromTrackMetadata(trackAttributes, regularCodec);

            if (streamInfo.widevinePssh !== undefined) {
                const decryptionKey = await getWidevineDecryptionKey(streamInfo.widevinePssh, streamInfo.trackId);
                const filePath = await downloadSong(streamInfo.streamUrl, decryptionKey, regularCodec, trackMetadata);
                res.download(filePath);
            } else {
                throw new Error("no decryption key found for regular codec! this is typical. don't fret!");
            }
        } else if (codecType.regularOrWebplayback === "webplayback") {
            const webplaybackCodec = codecType.codecType as WebplaybackCodecType; // safe cast, zod
            const webplaybackResponse = await appleMusicApi.getWebplayback(id);
            const trackMetadata = await appleMusicApi.getSong(id);
            const streamInfo = await StreamInfo.fromWebplayback(webplaybackResponse, webplaybackCodec);

            if (streamInfo.widevinePssh !== undefined) {
                const decryptionKey = await getWidevineDecryptionKey(streamInfo.widevinePssh, streamInfo.trackId);
                const filePath = await downloadSong(streamInfo.streamUrl, decryptionKey, webplaybackCodec, trackMetadata);
                res.download(filePath);
            } else {
                throw new Error("no decryption key found for web playback! this should not happen..");
            }
        }
    } catch (err) {
        next(err);
    }
});

export default router;
