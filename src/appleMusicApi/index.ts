import { ampApiUrl, appleMusicHomepageUrl, licenseApiUrl, webplaybackApiUrl } from "../constants/urls.js";
import { type GetLibrarySongsResponse, type GetAlbumResponse, type GetPlaylistResponse, type GetSongResponse, type SearchResponse } from "./types/responses.js";
import type { AlbumAttributesExtensionTypes, AnyAttributesExtensionTypes, SongAttributesExtensionTypes } from "./types/extensions.js";
import { appleMusicApiToken } from "./token.js";
import { HttpException } from "../web/index.js";
import type { RelationshipTypes } from "./types/relationships.js";
import { fetch, request } from "undici";
import { appleMusicAuthenticationCtx, defaultAuth, type AppleMusicAuthentication } from "./auth.js";

export default class AppleMusicApi {
    private sharedHeaders: Headers;
    private sharedParams: URLSearchParams;

    public constructor() {
        const auth = this.getAuth();

        this.sharedHeaders = new Headers();
        this.sharedHeaders.set("Origin", appleMusicHomepageUrl);
        this.sharedHeaders.set("Authorization", `Bearer ${appleMusicApiToken}`);
        this.sharedHeaders.set("Media-User-Token", auth.mediaUserToken);

        this.sharedParams = new URLSearchParams();
        this.sharedParams.set("l", auth.language);
    }

    private async get<T> (
        link: string,
        query: URLSearchParams
    ): Promise<T> {
        const url = new URL(link);
        url.search = new URLSearchParams([
            ...this.sharedParams,
            ...query
        ]).toString();

        const response = await request(url, { headers: this.sharedHeaders });
        const json = await response.body.json();
        return json as T;
    }

    private async post<T> (
        link: string,
        data: object
    ): Promise<T> {
        const url = new URL(link);
        url.search = this.sharedParams.toString();
        const headers = this.sharedHeaders;
        headers.set("Content-Type", "application/json");

        const response = await fetch(url, { method: "POST", body: JSON.stringify(data), headers });
        const json = await response.json();
        return json as T;
    }

    private getAuth(): AppleMusicAuthentication {
        const store = appleMusicAuthenticationCtx.getStore();
        if (
            store === undefined ||
            store.language === undefined ||
            store.mediaUserToken === undefined ||
            store.storefront === undefined
        )
        { return defaultAuth; } else
        { return store; }
    }

    async getAlbum<
        T extends AlbumAttributesExtensionTypes = [],
        U extends RelationshipTypes<T> = ["tracks"]
    > (
        id: string,
        extend: T = [] as unknown[] as T,
        relationships: U = ["tracks"] as U
    ): Promise<GetAlbumResponse<T, U>> {
        const auth = this.getAuth();
        return await this.get<GetAlbumResponse<T, U>>(`${ampApiUrl}/v1/catalog/${auth.storefront}/albums/${id}`, new URLSearchParams({
            extend: extend.join(","),
            include: relationships.join(",")
        }));
    }

    async getLibrarySongs<
        T extends [],
        U extends RelationshipTypes<T> = ["albums", "artists"]
    > (
        limit = 100,
        offset = 0,
        relationships: U = ["albums", "artists"] as U
    ): Promise<GetLibrarySongsResponse<T, U>> {
        return await this.get<GetLibrarySongsResponse<T, U>>(`${ampApiUrl}/v1/me/library/songs`, new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            include: relationships.join(",")
        }));
    }

    // TODO: make it so you can get more than the first 100 tracks
    // you can't since it's entirely undocumented
    // and the "trivial" way simply throws a 400, which is awesome
    async getPlaylist<
        T extends SongAttributesExtensionTypes = [],
        U extends RelationshipTypes<T> = ["tracks"]
    > (
        id: string,
        extend: T = [] as unknown[] as T,
        relationships: U = ["tracks"] as U
    ): Promise<GetPlaylistResponse<T, U>> {
        const auth = this.getAuth();
        return await this.get<GetPlaylistResponse<T, U>>(`${ampApiUrl}/v1/catalog/${auth.storefront}/playlists/${id}`, new URLSearchParams({
            extend: extend.join(","),
            include: relationships.join(",")
        }));
    }

    async getSong<
        // TODO: possibly make this any, and use the addScopingParameters function?
        // would be a bit cleaner, almost everywhere, use above in `getAlbum` perchancibly
        // and `getPlaylist`.... maybe just rewrite the whole thing at this point,, scoping parameters are my OPP
        T extends SongAttributesExtensionTypes = ["extendedAssetUrls"],
        U extends RelationshipTypes<T> = ["albums"]
    > (
        id: string,
        extend: T = ["extendedAssetUrls"] as T,
        relationships: U = ["albums"] as U
    ): Promise<GetSongResponse<T, U>> {
        const auth = this.getAuth();
        return await this.get<GetSongResponse<T, U>>(`${ampApiUrl}/v1/catalog/${auth.storefront}/songs/${id}`, new URLSearchParams({
            extend: extend.join(","),
            include: relationships.join(",")
        }));
    }

    // TODO: add support for other types / abstract it for other types
    // i don't think we will use em, but completeness is peam
    async search<
        T extends AnyAttributesExtensionTypes = [],
        U extends RelationshipTypes<T> = ["tracks"]
    > (
        term: string,
        limit = 100,
        offset = 0,
        extend: T = [] as unknown[] as T,
        relationships: U = ["tracks"] as U
    ): Promise<SearchResponse<T, U>> {
        const auth = this.getAuth();
        return await this.get(`${ampApiUrl}/v1/catalog/${auth.storefront}/search`, new URLSearchParams({
            ...this.addScopingParameters("albums", relationships, extend),
            term: term,
            types: ["albums", "songs"].join(","), // adding "songs" makes search results have albums when searching song name
            limit: limit.toString(),
            offset: offset.toString(),
            extend: extend.join(","),
            include: relationships.join(",")
        }));
    }

    async getWebplayback(trackId: string): Promise<WebplaybackResponse> {
        // no way around this
        // as we know, we can't have fun things with "WOA" urls
        // https://files.catbox.moe/5oqolg.png (THE LINK WAS CENSORED?? TAKEN DOWN FROM CNN??)
        // https://files.catbox.moe/wjxwzk.png
        const auth = this.getAuth();
        const res = await this.post<WebplaybackResponse & { failureType?: string }>(webplaybackApiUrl, {
            salableAdamId: trackId,
            language: auth.language
        });

        if (res.failureType !== undefined) {
            switch (res.failureType) {
                case "3077": throw new HttpException(404, "track not found");
                case "3076": throw new HttpException(401, "content unavailable :( wrong storefront?");
                case "2002": throw new HttpException(500, "credentials expired! contact the owner or put in your own ones");
                default: throw new HttpException(500, `upstream webplayback api error: ${res.failureType}`);
            }
        }

        return res;
    }

    async getWidevineLicense(
        trackId: string,
        trackUri: string,
        challenge: string
    ): Promise<WidevineLicenseResponse> {
        return await this.post(licenseApiUrl, {
            challenge,
            "key-system": "com.widevine.alpha",
            uri: trackUri,
            adamId: trackId,
            isLibrary: false,
            "user-initiated": true
        });
    }

    // helper function to automatically add scoping parameters
    // this is so i don't have to make those work in typescript
    addScopingParameters(
        names: string | string[],
        relationships: string[],
        extend: string[]
    ): Record<string, string> {
        const params: Record<string, string> = {};

        for (const name of Array.isArray(names) ? names : [names]) {
            for (const relationship of relationships) { params[`include[${name}]`] = relationship; }
            for (const extendType of extend) { params[`extend[${names}]`] = extendType; }
        }

        return params;
    }
}

// these are super special types
// i'm not putting this in the ./types folder.
// maybe ltr bleh
export interface WebplaybackResponse { songList: { assets: { flavor: string, URL: string }[], songId: string }[] };
export interface WidevineLicenseResponse { license: string | undefined };
