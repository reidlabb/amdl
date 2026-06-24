import express from "express";

const router = express.Router();

router.get("/login", async (req, res, next) => {
    try {
        res.render("login", {
            title: "login"
        });
    } catch (err) {
        next(err);
    }
});

export default router;
