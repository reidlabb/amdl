import express from "express";
import { paths } from "../../openApi.js";
import z from "zod";
import { CodecType, regularCodecTypeSchema, webplaybackCodecTypeSchema, type RegularCodecType, type WebplaybackCodecType } from "../../../downloader/codecType.js";
import { validate } from "../../validate.js";
import StreamInfo from "../../../downloader/streamInfo.js";
import { appleMusicApi } from "../../../appleMusicApi/index.js";
import { getWidevineDecryptionKey } from "../../../downloader/keygen.js";
import { fetchAndDecryptStreamSegment } from "../../../downloader/index.js";

const router = express.Router();

const path = "/downloadSegment";
const schema = z.object({
    query: z.object({
        id: z.string(),
        originalMp4: z.url(),
        codec: z.enum([...regularCodecTypeSchema.options, ...webplaybackCodecTypeSchema.options])
    }),
    headers: z.object({
        range: z
            .string()
            .regex(/bytes=\d+-\d+/)
            .transform((val) => {
                // safe because of regex
                const parts = val.split("=");
                const values = parts[1].split("-");
                return {
                    start: parseInt(values[0], 10),
                    end: parseInt(values[1], 10)
                };
            })
    })
});

paths[path] = {
    get: {
        description: "returns a segment of a song in an mp4 container (see headers, single part byte ranges only) will fail to decrypt if full samples and initialization vectors are not included (and their metadata.) for use with translating m3u8 files that apple provides",
        requestParams: { query: schema.shape.query, header: schema.shape.headers },
        responses: {
            200: { description: "returns a segment of a song in an mp4 container" },
            400: { description: "bad request, invalid query parameters. sent as a zod error with details" },
            default: { description: "upstream api error, or some other error" }
        }
    }
};

// TODO: cache the decryption key for a while, so we don't have to fetch it every time
// the way we could do that is store track id + codec mapped to a decryption key (in memory? for like how long? maybe have an expiry?)
router.get(path, async (req, res, next) => {
    try {
        const { id, originalMp4, codec } = (await validate(req, schema)).query;
        const { range: { start, end } } = (await validate(req, schema)).headers;

        const codecType = new CodecType(codec);

        if (codecType.regularOrWebplayback === "regular") {
            const regularCodec = codecType.codecType as RegularCodecType; // safe cast, zod
            const trackMetadata = await appleMusicApi.getSong(id);
            const trackAttributes = trackMetadata.data[0].attributes;
            const streamInfo = await StreamInfo.fromTrackMetadata(trackAttributes, regularCodec);

            if (streamInfo.widevinePssh !== undefined) {
                const decryptionKey = await getWidevineDecryptionKey(streamInfo.widevinePssh, streamInfo.trackId);
                const file = await fetchAndDecryptStreamSegment(originalMp4, decryptionKey, end - start + 1, start);

                res.setHeader("Content-Type", "application/mp4");
                res.setHeader("Content-Range", `bytes ${start}-${end}/*`);
                res.setHeader("Accept-Ranges", "bytes");
                res.status(206).send(file);
            } else {
                throw new Error("no decryption key found for regular codec! this is typical. don't fret!");
            }
        } else if (codecType.regularOrWebplayback === "webplayback") {
            const webplaybackCodec = codecType.codecType as WebplaybackCodecType; // safe cast, zod
            const webplaybackResponse = await appleMusicApi.getWebplayback(id);
            const streamInfo = await StreamInfo.fromWebplayback(webplaybackResponse, webplaybackCodec);

            if (streamInfo.widevinePssh !== undefined) {
                const decryptionKey = await getWidevineDecryptionKey(streamInfo.widevinePssh, streamInfo.trackId);
                const file = await fetchAndDecryptStreamSegment(originalMp4, decryptionKey, end - start + 1, start);

                res.setHeader("Content-Type", "application/mp4");
                res.setHeader("Content-Range", `bytes ${start}-${end}/*`);
                res.setHeader("Accept-Ranges", "bytes");
                res.status(206).send(file);
            } else {
                throw new Error("no decryption key found for web playback! this should not happen..");
            }
        }
    } catch (err) {
        next(err);
    }
});

export default router;
