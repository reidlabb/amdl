import express from "express";
import { paths } from "../../openApi.js";

const router = express.Router();

const path = "/logout";

paths[path] = {
    get: {
        responses: {
            200: { description: "nothing interesting. sets your cookies" },
            400: { description: "bad request, invalid query parameters. sent as a zod error with details" },
            default: { description: "upstream api error, or some other error" }
        }
    }
};

router.post(path, async (_req, res, next) => {
    try {
        res.clearCookie("language");
        res.clearCookie("mediaUserToken");
        res.clearCookie("storefront");
        res.redirect("/login");
    } catch (err) {
        next(err);
    }
});

export default router;
