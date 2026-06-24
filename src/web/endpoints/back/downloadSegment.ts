import express from "express";
import { paths } from "../../openApi.js";
import z from "zod";
import { CodecType, regularCodecTypeSchema, webplaybackCodecTypeSchema, type RegularCodecType, type WebplaybackCodecType } from "../../../downloader/codecType.js";
import { validate } from "../../validate.js";
import StreamInfo from "../../../downloader/streamInfo.js";
import { appleMusicApi } from "../../../appleMusicApi/index.js";
import { getWidevineDecryptionKey } from "../../../downloader/keygen.js";
import { fetchAndDecryptStreamSegment } from "../../../downloader/index.js";
import { addKeyToCache, getKeyFromCache } from "../../../cache.js";
import { apiAuthentication } from "../../../appleMusicApi/auth.js";

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
    }),
    cookies: apiAuthentication.optional()
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

router.get(path, async (req, res, next) => {
    try {
        const { id, originalMp4, codec } = (await validate(req, schema)).query;
        const { range: { start, end } } = (await validate(req, schema)).headers;
        const auth = (await validate(req, schema)).cookies;

        const codecType = new CodecType(codec);

        const trackMetadata = await appleMusicApi.getSong(id);
        const trackAttributes = trackMetadata.data[0].attributes;
        const streamInfo = await (codecType.regularOrWebplayback === "regular"
            ? StreamInfo.fromTrackMetadata(trackAttributes, codecType.codecType as RegularCodecType)
            : StreamInfo.fromWebplayback(await appleMusicApi.getWebplayback(id, auth), codecType.codecType as WebplaybackCodecType)
        );

        if (streamInfo.widevinePssh === undefined) {
            if (codecType.regularOrWebplayback === "regular") { throw new Error("failed to get widevine pssh, this is typical"); }
            else { throw new Error("failed to get widevine pssh for web playback, this should not happen.."); }
        }

        const decryptionKey =
            await getKeyFromCache(id, codecType.codecType) ??
            await getWidevineDecryptionKey(streamInfo.widevinePssh, streamInfo.trackId, auth);
        await addKeyToCache(id, codecType.codecType, decryptionKey);

        const file = await fetchAndDecryptStreamSegment(originalMp4, decryptionKey, end - start + 1, start);
        res.setHeader("Content-Type", "application/mp4");
        res.setHeader("Content-Range", `bytes ${start}-${end}/*`);
        res.setHeader("Accept-Ranges", "bytes");
        res.status(206).send(file);
    } catch (err) {
        next(err);
    }
});

export default router;
