import z from "zod";

export interface AppleMusicApiAuthentication {
    language: string;
    mediaUserToken: string;
    storefront: string;
}

export const apiAuthentication = z.object({
    language: z.string(),
    mediaUserToken: z.string(),
    storefront: z.string()
});
