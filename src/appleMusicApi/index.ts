import { ampApiUrl, appleMusicHomepageUrl, licenseApiUrl, webplaybackApiUrl } from "../constants/urls.js";
import type { GetAlbumResponse, GetPlaylistResponse, GetSongResponse, SearchResponse } from "./types/responses.js";
import type { AlbumAttributesExtensionTypes, AnyAttributesExtensionTypes, SongAttributesExtensionTypes } from "./types/extensions.js";
import { getToken } from "./token.js";
import { config, env } from "../config.js";
import { HttpException } from "../web/index.js";
import type { RelationshipTypes } from "./types/relationships.js";
import { fetch, request } from "undici";

export default class AppleMusicApi {
    private storefront: string;
    private headers: Headers;
    private params: URLSearchParams;

    public constructor(
        storefront: string,
        language: string,
        mediaUserToken: string
    ) {
        this.storefront = storefront;

        this.headers = new Headers();
        this.headers.set("Origin", appleMusicHomepageUrl);
        this.headers.set("Media-User-Token", mediaUserToken);
        this.headers.set("x-apple-music-user-token", mediaUserToken);
        this.headers.set("x-apple-renewal", "true");

        this.params = new URLSearchParams();
        this.params.set("l", language);
    }

    public async login(): Promise<void> {
        this.headers.set("Authorization", `Bearer ${await getToken(appleMusicHomepageUrl)}`);
    }

    // TODO: dedupe these functions
    // TODO: also make their param/body/header stuff more modular
    // please!!!!!
    private async get<
        T
    > (link: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
        const url = new URL(link);
        const urlParams = new URLSearchParams(this.params);
        for (const entry of Object.entries(params)) { urlParams.set(entry[0], entry[1].toString()); }
        url.search = urlParams.toString();

        const response = await request(url, { headers: this.headers });
        const json = await response.body.json();
        return json as T;
    }

    // TODO: discover why it works when its fetch but not request
    // what i mean by "works" is it doesn't return an error upstream that i can't replicate in cURL
    // i'm so confused mannnn
    private async post<
        T
    > (link: string, data: Record<string, string | number | boolean> = {}): Promise<T> {
        const url = new URL(link);
        const urlParams = new URLSearchParams(this.params);
        url.search = urlParams.toString();

        const headers = new Headers(this.headers);
        headers.set("Content-Type", "application/json");

        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(data),
            headers: headers
        });

        const json = await response.json();
        return json as T;
    }

    async getAlbum<
        T extends AlbumAttributesExtensionTypes = [],
        U extends RelationshipTypes<T> = ["tracks"]
    > (
        id: string,
        extend: T = [] as unknown[] as T,
        relationships: U = ["tracks"] as U
    ): Promise<GetAlbumResponse<T, U>> {
        return await this.get<GetAlbumResponse<T, U>>(`${ampApiUrl}/v1/catalog/${this.storefront}/albums/${id}`, {
            extend: extend.join(","),
            include: relationships.join(",")
        });
    }

    // TODO: make it so you can get more than the first 100 tracks
    // you can't since it's entirely undocumented
    // and the "trivial" way simply throws a 400, which is awesome
    async getPlaylist<
        T extends SongAttributesExtensionTypes = [],
        U extends RelationshipTypes<T> = ["tracks"]
    > (
        id: string,
        extend: T = [] as never as T,
        relationships: U = ["tracks"] as U
    ): Promise<GetPlaylistResponse<T, U>> {
        return await this.get<GetPlaylistResponse<T, U>>(`${ampApiUrl}/v1/catalog/${this.storefront}/playlists/${id}`, {
            extend: extend.join(","),
            include: relationships.join(",")
        });
    }

    async getSong<
        // TODO: possibly make this any, and use the addScopingParameters function?
        // would be a bit cleaner, almost everywhere, use above in `getAlbum` perchancibly
        // and `getPlaylst`.... maybe just rewrite the whole thing at this point,, scoping parameters are my OPP
        T extends SongAttributesExtensionTypes = ["extendedAssetUrls"],
        U extends RelationshipTypes<T> = ["albums"]
    > (
        id: string,
        extend: T = ["extendedAssetUrls"] as T,
        relationships: U = ["albums"] as U
    ): Promise<GetSongResponse<T, U>> {
        return await this.get<GetSongResponse<T, U>>(`${ampApiUrl}/v1/catalog/${this.storefront}/songs/${id}`, {
            extend: extend.join(","),
            include: relationships.join(",")
        });
    }

    // TODO: add support for other types / abstract it for other types
    // i don't think we will use em, but completeness is peam
    async search<
        T extends AnyAttributesExtensionTypes = [],
        U extends RelationshipTypes<T> = ["tracks"]
    > (
        term: string,
        limit = 25,
        offset = 0,
        extend: T = [] as unknown[] as T,
        relationships: U = ["tracks"] as U
    ): Promise<SearchResponse<T, U>> {
        return await this.get(`${ampApiUrl}/v1/catalog/${this.storefront}/search`, {
            ...this.addScopingParameters("albums", relationships, extend),
            ...{
                term: term,
                types: ["albums", "songs"].join(","), // adding "songs" makes search results have albums when searching song name
                limit: limit,
                offset: offset,
                extend: extend.join(","),
                include: relationships.join(",")
            }
        });
    }

    async getWebplayback(
        trackId: string
    ): Promise<WebplaybackResponse> {
        // no way around this
        // as we know, we can't have fun things with "WOA" urls
        // https://files.catbox.moe/5oqolg.png (THE LINK WAS CENSORED?? TAKEN DOWN FROM CNN??)
        // https://files.catbox.moe/wjxwzk.png
        const res = await this.post<WebplaybackResponse & { failureType?: string }>(webplaybackApiUrl, {
            salableAdamId: trackId,
            language: config.downloader.api.language
        });

        if (res?.failureType === "3077") {
            throw new HttpException(404, "track not found");
        } else if (res?.failureType !== undefined) {
            throw new HttpException(500, `upstream webplayback api error: ${res.failureType}`);
        }

        return res;
    }

    async getWidevineLicense(
        trackId: string,
        trackUri: string,
        challenge: string
    ): Promise<WidevineLicenseResponse> {
        return (await this.post(licenseApiUrl, {
            challenge: challenge,
            "key-system": "com.widevine.alpha",
            uri: trackUri,
            adamId: trackId,
            isLibrary: false,
            "user-initiated": true
        }));
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
