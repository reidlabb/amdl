import express from "express";
import { validate } from "../../validate.js";
import { z } from "zod";
import { paths } from "../../openApi.js";
import AppleMusicApi from "../../../appleMusicApi/index.js";

const router = express.Router();

const path = "/getTrackMetadata";
const schema = z.object({
    query: z.object({
        id: z.string()
    })
});

paths[path] = {
    get: {
        requestParams: { query: schema.shape.query },
        responses: {
            200: { description: "returns from the apple music api, track metadata with `extendedAssetUrls` extension and `albums` relationship https://developer.apple.com/documentation/applemusicapi/get-a-catalog-song" },
            400: { description: "bad request, invalid query parameters. sent as a zod error with details" },
            default: { description: "upstream api error, or some other error" }
        }
    }
};

router.get(path, async (req, res, next) => {
    try {
        const { id } = (await validate(req, schema)).query;

        const appleMusicApi = new AppleMusicApi();

        const trackMetadata = await appleMusicApi.getSong(id);

        res.json(trackMetadata);
    } catch (err) {
        next(err);
    }
});

export default router;
