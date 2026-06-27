import express from "express";
import { validate } from "../../validate.js";
import z from "zod";
import { CodecType, regularCodecTypeSchema, webplaybackCodecTypeSchema, type RegularCodecType, type WebplaybackCodecType } from "../../../downloader/codecType.js";
import AppleMusicApi from "../../../appleMusicApi/index.js";
import StreamInfo from "../../../downloader/streamInfo.js";
import { paths } from "../../openApi.js";

const router = express.Router();

const path = "/convertPlaylist";
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
            200: { description: "returns a m3u8 playlist for the song" },
            400: { description: "bad request, invalid query parameters. sent as a zod error with details" },
            default: { description: "upstream api error, or some other error" }
        }
    }
};

router.get(path, async (req, res, next) => {
    try {
        const { id, codec } = (await validate(req, schema)).query;
        const codecType = new CodecType(codec);

        const appleMusicApi = new AppleMusicApi();

        const trackMetadata = await appleMusicApi.getSong(id);
        const trackAttributes = trackMetadata.data[0].attributes;
        const streamInfo = await (codecType.regularOrWebplayback === "regular"
            ? StreamInfo.fromTrackMetadata(trackAttributes, codecType.codecType as RegularCodecType)
            : StreamInfo.fromWebplayback(await appleMusicApi.getWebplayback(id), codecType.codecType as WebplaybackCodecType)
        );

        const m3u8Parsed = streamInfo.streamParsed;
        const streamUrl = streamInfo.streamUrl;

        const ogMp4Name = m3u8Parsed.segments[0].uri;
        const ogMp4Url = streamUrl.substring(0, streamUrl.lastIndexOf("/")) + "/" + ogMp4Name;

        const mp4PathParams = new URLSearchParams();
        mp4PathParams.append("id", id);
        mp4PathParams.append("originalMp4", ogMp4Url);
        mp4PathParams.append("codec", codec);
        const mp4Path = "downloadSegment" + "?" + mp4PathParams.toString();

        const m3u8Text = m3u8Parsed.lines.map((line) => {
            if (line.name === "key") { return ""; }
            if (line.name === "map") { return line.content.replace(/(URI=")[^"]*(")/, `$1${mp4Path}$2`); }
            if (!line.content.startsWith("#")) { return mp4Path; }
            return line.content;
        });

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.send(m3u8Text.join("\n"));
    } catch (err) {
        next(err);
    }
});

export default router;
