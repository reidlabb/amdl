import express from "express";
import swaggerUi from "swagger-ui-express";
import { doc } from "../../openApi.js";

const router = express.Router();

router.use("/documentation", swaggerUi.serve);
router.get("/documentation", async (_req, res, next) => {
    try {
        res.send(swaggerUi.generateHTML(doc, {
            customCss: ".swagger-ui .topbar { display: none }",
            customSiteTitle: "amdl - documentation",
            customfavIcon: "/favicon.png"
        }));
    } catch (err) {
        next(err);
    }
});

export default router;
