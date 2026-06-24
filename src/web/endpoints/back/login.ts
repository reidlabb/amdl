import express from "express";
import { validate } from "../../validate.js";
import { z } from "zod";
import { paths } from "../../openApi.js";

const router = express.Router();

const path = "/login";
const schema = z.object({
    body: z.object({
        language: z.string(),
        mediaUserToken: z.string(),
        storefront: z.string()
    })
});

paths[path] = {
    get: {
        requestBody: {
            content: {
                "application/x-www-form-urlencoded": schema.shape
            }
        },
        responses: {
            200: { description: "nothing interesting. sets your cookies" },
            400: { description: "bad request, invalid query parameters. sent as a zod error with details" },
            default: { description: "upstream api error, or some other error" }
        }
    }
};

router.post(path, async (req, res, next) => {
    try {
        const {
            language,
            mediaUserToken,
            storefront
        } = (await validate(req, schema)).body;

        res.cookie("language", language);
        res.cookie("mediaUserToken", mediaUserToken);
        res.cookie("storefront", storefront);
        res.redirect("/login");
    } catch (err) {
        next(err);
    }
});

export default router;
