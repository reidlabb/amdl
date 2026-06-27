import { AsyncLocalStorage } from "node:async_hooks";
import { config, env } from "../config.js";
import z from "zod";
import type { NextFunction, Request, Response } from "express";

export interface AppleMusicAuthentication {
    language: string;
    mediaUserToken: string;
    storefront: string;
}

export const appleMusicAuthentication = z.object({
    language: z.string(),
    mediaUserToken: z.string(),
    storefront: z.string()
});

export const appleMusicAuthenticationCtx = new AsyncLocalStorage<AppleMusicAuthentication>();
export const appleMusicAuthenticationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    appleMusicAuthenticationCtx.run({
        language: req.cookies["language"],
        mediaUserToken: req.cookies["mediaUserToken"],
        storefront: req.cookies["storefront"]
    }, next);
};

export const defaultAuth: AppleMusicAuthentication = {
    language: config.downloader.api.language,
    mediaUserToken: env.MEDIA_USER_TOKEN,
    storefront: env.ITUA
};
