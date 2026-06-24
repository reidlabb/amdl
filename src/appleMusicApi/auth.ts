import z from "zod";

export interface AppleMusicApiAuthentication {
    language: string;
    mediaUserToken: string;
    storefront: string;
}

export const apiAuthentication = z.preprocess((val) => {
    if (typeof val !== "object" || val === null) return undefined;

    const { language, mediaUserToken, storefront } = val as Record<string, unknown>;
    if (!language || !mediaUserToken || !storefront) return undefined;
    return { language, mediaUserToken, storefront };
}, z.union([
    z.object({
        language: z.string(),
        mediaUserToken: z.string(),
        storefront: z.string()
    }),
    z.undefined()
]));
