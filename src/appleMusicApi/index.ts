import { ampApiUrl, appleMusicHomepageUrl, licenseApiUrl, webplaybackApiUrl } from "../constants/urls.js";
import type { GetAlbumResponse, GetPlaylistResponse, GetSongResponse, SearchResponse } from "./types/responses.js";
import type { AlbumAttributesExtensionTypes, AnyAttributesExtensionTypes, SongAttributesExtensionTypes } from "./types/extensions.js";
import { getToken } from "./token.js";
import { config, env } from "../config.js";
import { HttpException } from "../web/index.js";
import type { RelationshipTypes } from "./types/relationships.js";
import { fetch, request } from "undici";
import type { AppleMusicApiAuthentication } from "./auth.js";

export default class AppleMusicApi {
    private sharedHeaders: Headers;
    private defaultAuth: AppleMusicApiAuthentication;

    public constructor(
        storefront: string,
        language: string,
        mediaUserToken: string
    ) {
        this.defaultAuth = {
            storefront: storefront,
            language,
            mediaUserToken
        };

        this.sharedHeaders = new Headers();
        this.sharedHeaders.set("Origin", appleMusicHomepageUrl);
    }

    public async setToken(): Promise<void> {
        this.sharedHeaders.set("Authorization", `Bearer ${await getToken(appleMusicHomepageUrl)}`);
    }

    private async get<T> (
        link: string,
        query: URLSearchParams,
        auth = this.defaultAuth
    ): Promise<T> {
        const url = new URL(link);
        const params = query;
        params.set("l", auth.language);
        url.search = params.toString();
        const headers = this.sharedHeaders;
        headers.set("Media-User-Token", auth.mediaUserToken);

        const response = await request(url, { headers });
        const json = await response.body.json();
        return json as T;
    }

    private async post<T> (
        link: string,
        data: object,
        auth = this.defaultAuth
    ): Promise<T> {
        const url = new URL(link);
        const params = new URLSearchParams({ l: auth.language });
        url.search = params.toString();
        const headers = this.sharedHeaders;
        headers.set("Media-User-Token", auth.mediaUserToken);
        headers.set("Content-Type", "application/json");

        const response = await fetch(url, { method: "POST", body: JSON.stringify(data), headers });
        const json = await response.json();
        return json as T;
    }

    async getAlbum<
        T extends AlbumAttributesExtensionTypes = [],
        U extends RelationshipTypes<T> = ["tracks"]
    > (
        id: string,
        auth = this.defaultAuth,
        extend: T = [] as unknown[] as T,
        relationships: U = ["tracks"] as U
    ): Promise<GetAlbumResponse<T, U>> {
        return await this.get<GetAlbumResponse<T, U>>(`${ampApiUrl}/v1/catalog/${auth.storefront}/albums/${id}`, new URLSearchParams({
            extend: extend.join(","),
            include: relationships.join(",")
        }), auth);
    }

    // TODO: make it so you can get more than the first 100 tracks
    // you can't since it's entirely undocumented
    // and the "trivial" way simply throws a 400, which is awesome
    async getPlaylist<
        T extends SongAttributesExtensionTypes = [],
        U extends RelationshipTypes<T> = ["tracks"]
    > (
        id: string,
        auth = this.defaultAuth,
        extend: T = [] as unknown[] as T,
        relationships: U = ["tracks"] as U
    ): Promise<GetPlaylistResponse<T, U>> {
        return await this.get<GetPlaylistResponse<T, U>>(`${ampApiUrl}/v1/catalog/${auth.storefront}/playlists/${id}`, new URLSearchParams({
            extend: extend.join(","),
            include: relationships.join(",")
        }), auth);
    }

    async getSong<
        // TODO: possibly make this any, and use the addScopingParameters function?
        // would be a bit cleaner, almost everywhere, use above in `getAlbum` perchancibly
        // and `getPlaylst`.... maybe just rewrite the whole thing at this point,, scoping parameters are my OPP
        T extends SongAttributesExtensionTypes = ["extendedAssetUrls"],
        U extends RelationshipTypes<T> = ["albums"]
    > (
        id: string,
        auth = this.defaultAuth,
        extend: T = ["extendedAssetUrls"] as T,
        relationships: U = ["albums"] as U
    ): Promise<GetSongResponse<T, U>> {
        return await this.get<GetSongResponse<T, U>>(`${ampApiUrl}/v1/catalog/${auth.storefront}/songs/${id}`, new URLSearchParams({
            extend: extend.join(","),
            include: relationships.join(",")
        }), auth);
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
        auth = this.defaultAuth,
        extend: T = [] as unknown[] as T,
        relationships: U = ["tracks"] as U
    ): Promise<SearchResponse<T, U>> {
        return await this.get(`${ampApiUrl}/v1/catalog/${auth.storefront}/search`, new URLSearchParams({
            ...this.addScopingParameters("albums", relationships, extend),
            term: term,
            types: ["albums", "songs"].join(","), // adding "songs" makes search results have albums when searching song name
            limit: limit.toString(),
            offset: offset.toString(),
            extend: extend.join(","),
            include: relationships.join(",")
        }), auth);
    }

    async getWebplayback(
        trackId: string,
        auth = this.defaultAuth
    ): Promise<WebplaybackResponse> {
        // no way around this
        // as we know, we can't have fun things with "WOA" urls
        // https://files.catbox.moe/5oqolg.png (THE LINK WAS CENSORED?? TAKEN DOWN FROM CNN??)
        // https://files.catbox.moe/wjxwzk.png
        const res = await this.post<WebplaybackResponse & { failureType?: string }>(webplaybackApiUrl, {
            salableAdamId: trackId,
            language: config.downloader.api.language
        }, auth);

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
        challenge: string,
        auth = this.defaultAuth
    ): Promise<WidevineLicenseResponse> {
        return await this.post(licenseApiUrl, {
            challenge,
            "key-system": "com.widevine.alpha",
            uri: trackUri,
            adamId: trackId,
            isLibrary: false,
            "user-initiated": true
        }, auth);
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

export const appleMusicApi = new AppleMusicApi(env.ITUA, config.downloader.api.language, env.MEDIA_USER_TOKEN);

// these are super special types
// i'm not putting this in the ./types folder.
// maybe ltr bleh
export interface WebplaybackResponse { songList: { assets: { flavor: string, URL: string }[], songId: string }[] };
export interface WidevineLicenseResponse { license: string | undefined };
