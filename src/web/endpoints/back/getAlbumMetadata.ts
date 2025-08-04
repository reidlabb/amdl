import { appleMusicApi } from "../../../appleMusicApi/index.js";
import express from "express";
import { validate } from "../../validate.js";
import { z } from "zod";
import { paths } from "../../openApi.js";

const router = express.Router();

const path = "/getAlbumMetadata";
const schema = z.object({
    query: z.object({
        id: z.string()
    })
});

paths[path] = {
    get: {
        requestParams: { query: schema.shape.query },
        responses: {
            200: { description: "returns from the apple music api, album metadata with `tracks` relationship https://developer.apple.com/documentation/applemusicapi/get-a-catalog-album" },
            400: { description: "bad request, invalid query parameters. sent as a zod error with details" },
            default: { description: "upstream api error, or some other error" }
        }
    }
};

// see comments in `getTrackMetadata.ts`
// awawawawawa
router.get(path, async (req, res, next) => {
    try {
        const { id } = (await validate(req, schema)).query;

        const albumMetadata = await appleMusicApi.getAlbum(id);

        res.json(albumMetadata);
    } catch (err) {
        next(err);
    }
});

export default router;
