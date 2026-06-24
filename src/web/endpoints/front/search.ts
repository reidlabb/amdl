import express from "express";
import { validate } from "../../validate.js";
import { z } from "zod";
import { appleMusicApi } from "../../../appleMusicApi/index.js";
import { config } from "../../../config.js";
import queryString from "node:querystring";
import { apiAuthentication } from "../../../appleMusicApi/auth.js";

const router = express.Router();

const schema = z.object({
    query: z.object({
        q: z.optional(z.string()),
        page: z.optional(z.coerce.number().int().min(0))
    }),
    cookies: apiAuthentication.optional()
});

router.get("/", async (req, res, next) => {
    try {
        const { q, page } = (await validate(req, schema)).query;
        const auth = (await validate(req, schema)).cookies;

        const offset = page ? (page - 1) * config.server.frontend.search_count : 0;
        const results = (q && await appleMusicApi.search(q, config.server.frontend.search_count, offset, auth)) || undefined;
        const albums = results?.results?.albums;

        res.render("search", {
            title: "search",
            query: q,
            page: page ?? 1,
            back: req.path + "?" + queryString.stringify({ q: q, page: (page ?? 1) - 1 }),
            next: (albums?.next !== undefined && req.path + "?" + queryString.stringify({ q: q, page: (page ?? 1) + 1 })) || undefined,
            results: albums?.data.map((result) => {
                const { artistName, artwork, name } = result.attributes;

                // use 220x220 cover, it's what the real apple music uses for larger sizes on the <picture> tag for search results
                // the reason we should use this is that apple won't have to resize the image for us (cached), making this slightly snappier
                // may be lying, but logically it makes sense
                // in fact: `x-cache-hits` is greater than 0, sometimes :)
                const cover = artwork.url.replace("{w}", "220").replace("{h}", "220");
                const tracks = result.relationships.tracks.data;

                return {
                    name: name,
                    artists: [artistName],
                    cover: cover,
                    id: result.attributes.playParams?.id,
                    isAlbum: true,
                    tracks: tracks.map((track) => {
                        const { artistName, name, durationInMillis, discNumber, trackNumber } = track.attributes;

                        return {
                            discNumber: discNumber,
                            trackNumber: trackNumber,
                            name: name,
                            artists: [artistName],
                            duration: durationInMillis,
                            cover: cover,
                            id: track.attributes.playParams?.id,
                            isAlbum: false
                        };
                    })
                };
            })
        });
    } catch (err) {
        next(err);
    }
});

export default router;
