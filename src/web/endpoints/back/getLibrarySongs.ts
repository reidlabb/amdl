import AppleMusicApi from "../../../appleMusicApi/index.js";
import express from "express";
import { validate } from "../../validate.js";
import { z } from "zod";
import { paths } from "../../openApi.js";
import { appleMusicAuthentication } from "../../../appleMusicApi/auth.js";

const router = express.Router();

const path = "/getLibrarySongs";
const schema = z.object({
    query: z.object({
        limit: z.optional(z.coerce.number().int().min(0).max(100)),
        offset: z.optional(z.coerce.number().int().min(0))
    }),
    cookies: appleMusicAuthentication
});

paths[path] = {
    get: {
        requestParams: {
            query: schema.shape.query,
            cookie: appleMusicAuthentication
        },
        responses: {
            200: { description: "returns from the apple music api, songs with the `artists` and `albums` relationships https://developer.apple.com/documentation/applemusicapi/get-all-library-songs" },
            400: { description: "bad request, invalid query parameters. sent as a zod error with details" },
            default: { description: "upstream api error, or some other error" }
        }
    }
};

router.get(path, async (req, res, next) => {
    try {
        const { limit, offset } = (await validate(req, schema)).query;

        const appleMusicApi = new AppleMusicApi();

        const librarySongs = await appleMusicApi.getLibrarySongs(limit, offset);

        res.json(librarySongs);
    } catch (err) {
        next(err);
    }
});

export default router;
