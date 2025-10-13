import * as log from "../log.js";
import type { SongAttributes } from "../appleMusicApi/types/attributes.js";
import hls, { Item } from "parse-hls";
import { widevine, playready, fairplay } from "../constants/keyFormats.js";
import { songCodecRegex } from "../constants/codecs.js";
import type { WebplaybackResponse } from "appleMusicApi/index.js";
import type { RegularCodecType, WebplaybackCodecType } from "./codecType.js";
import { request } from "undici";

// why is this private
// i wish pain on the person who wrote this /j :smile:
type M3u8 = ReturnType<typeof hls.default.parse>;

export default class StreamInfo {
    public readonly trackId: string;
    public readonly streamUrl: string;
    public readonly streamParsed: M3u8;
    public readonly primaryFileUrl: string;
    public readonly widevinePssh: string | undefined;
    public readonly playreadyPssh: string | undefined;
    public readonly fairplayKey: string | undefined;

    private constructor(
        trackId: string,
        streamUrl: string,
        streamParsed: M3u8,
        primaryFileUrl: string,
        widevinePssh: string | undefined,
        playreadyPssh: string | undefined,
        fairplayKey: string | undefined
    ) {
        this.trackId = trackId;
        this.streamUrl = streamUrl;
        this.streamParsed = streamParsed;
        this.primaryFileUrl = primaryFileUrl;
        this.widevinePssh = widevinePssh;
        this.playreadyPssh = playreadyPssh;
        this.fairplayKey = fairplayKey;
    }

    // why can't we decrypt widevine ones with this?
    // we get a valid key.. but it doesn't work :-(
    // upd: it seems thats just how the cookie crumbles. oh well
    // upd: removed todo. as i said its just how it is
    public static async fromTrackMetadata(trackMetadata: SongAttributes<["extendedAssetUrls"]>, codec: RegularCodecType): Promise<StreamInfo> {
        log.warn("the track metadata method is experimental, and may not work or give correct values!");
        log.warn("if there is a failure--use a codec that uses the webplayback method");

        const m3u8Url = trackMetadata.extendedAssetUrls.enhancedHls;
        const m3u8 = await request(m3u8Url);
        const m3u8Parsed = hls.default.parse(await m3u8.body.text());

        const drmInfos = getDrmInfos(m3u8Parsed);
        const assetInfos = getAssetInfos(m3u8Parsed);
        const playlist = await getPlaylist(m3u8Parsed, codec);
        const variantId = playlist.properties[0].attributes.stableVariantId;
        if (variantId === undefined) { throw new Error("variant id does not exist!"); }
        if (typeof variantId !== "string") { throw new Error("variant id is not a string!"); }
        const drmIds = assetInfos[variantId]["AUDIO-SESSION-KEY-IDS"];

        const correctM3u8Url = m3u8Url.substring(0, m3u8Url.lastIndexOf("/")) + "/" + playlist.uri;
        const correctM3u8 = await request(correctM3u8Url);
        const correctM3u8Parsed = hls.default.parse(await correctM3u8.body.text());

        const primaryFileUrl = getPrimaryFileUrl(m3u8Parsed);

        const widevinePssh = getWidevinePssh(drmInfos, drmIds);
        const playreadyPssh = getPlayreadyPssh(drmInfos, drmIds);
        const fairplayKey = getFairplayKey(drmInfos, drmIds);

        const trackId = trackMetadata.playParams?.id;
        if (trackId === undefined) { throw new Error("track id gone, this may indicate your song isn't accessable w/ your subscription!"); }

        return new StreamInfo(
            trackId,
            correctM3u8Url,
            correctM3u8Parsed,
            primaryFileUrl,
            widevinePssh,
            playreadyPssh,
            fairplayKey
        );
    }

    // webplayback is the more "legacy" way
    // only supports widevine, from what i can tell
    public static async fromWebplayback(webplayback: WebplaybackResponse, codec: WebplaybackCodecType): Promise<StreamInfo> {
        const song = webplayback.songList[0];

        let flavor: string;
        if (codec === "aac_he_legacy") { flavor = "32:ctrp64"; }
        else if (codec === "aac_legacy") { flavor = "28:ctrp256"; }

        const asset = song.assets.find((asset) => { return asset.flavor === flavor; });
        if (asset === undefined) { throw new Error("webplayback info for requested flavor doesn't exist!"); }

        const trackId = song.songId;

        const m3u8Url = asset.URL;
        const m3u8 = await request(m3u8Url);
        const m3u8Parsed = hls.default.parse(await m3u8.body.text());

        const primaryFileUrl = getPrimaryFileUrl(m3u8Parsed);

        const widevinePssh =  m3u8Parsed.lines.find((line) => { return line.name === "key"; })?.attributes?.uri;
        if (widevinePssh === undefined) { throw new Error("widevine uri is missing!"); }
        if (typeof widevinePssh !== "string") { throw new Error("widevine uri is not a string!"); }

        // afaik this ONLY has widevine
        return new StreamInfo(
            trackId,
            m3u8Url,
            m3u8Parsed,
            primaryFileUrl,
            widevinePssh,
            undefined,
            undefined
        );
    }
}

function getPrimaryFileUrl(m3u8Data: M3u8): string {
    return m3u8Data.segments[0].uri;
}

type DrmInfos = Record<string, Record<string, { "URI": string }>>;;
function getDrmInfos(m3u8Data: M3u8): DrmInfos {
    // see `getAssetInfos` for the reason why this is so bad
    for (const line of m3u8Data.lines) {
        if (
            line.name === "sessionData" &&
            line.content.includes("com.apple.hls.AudioSessionKeyInfo")
        ) {
            const value = line.content.match(/VALUE="([^"]+)"/);
            if (!value) { throw new Error("could not match for drm key value!"); }
            if (!value[1]) { throw new Error("drm key value is empty!"); }

            return JSON.parse(Buffer.from(value[1], "base64").toString("utf-8"));
        }
    }

    throw new Error("m3u8 missing audio session key info!");
}

type AssetInfos = Record<string, { "AUDIO-SESSION-KEY-IDS": string[] }>;
function getAssetInfos(m3u8Data: M3u8): AssetInfos {
    // LOL??? THIS LIBRARY IS SO BAD
    // YOU CAN'T MAKE THIS SHIT UP
    // https://files.catbox.moe/ac0ps4.jpg
    for (const line of m3u8Data.lines) {
        if (
            line.name === "sessionData" &&
            line.content.includes("com.apple.hls.audioAssetMetadata")
        ) {
            const value = line.content.match(/VALUE="([^"]+)"/);
            if (!value) { throw new Error("could not match for value!"); }
            if (!value[1]) { throw new Error("value is empty!"); }

            return JSON.parse(Buffer.from(value[1], "base64").toString("utf-8"));
        }
    }

    throw new Error("m3u8 missing audio asset metadata!");
}

async function getPlaylist(m3u8Data: M3u8, codec: RegularCodecType): Promise<Item> {
    const masterPlaylists = m3u8Data.streamRenditions;
    const masterPlaylist = masterPlaylists.find((playlist) => {
        const line = playlist.properties[0].attributes?.audio;
        if (line === undefined) { return false; }
        if (typeof line !== "string") { return false; }
        const match = line.match(songCodecRegex[codec]);
        return match !== null;
    });

    if (masterPlaylist === undefined) { throw new Error("no master playlist for codec found!"); }

    return masterPlaylist;
}

function getDrmData(drmInfos: DrmInfos, drmIds: string[], drmKey: string): string | undefined {
    const drmInfoEntry = drmIds.find((drmId) => {
        const entry = drmInfos[drmId];
        return drmId !== "1" && entry?.[drmKey];
    });

    if (drmInfoEntry === undefined) { return undefined; }

    const drmInfo = drmInfos[drmInfoEntry];
    return drmInfo[drmKey].URI;
}

const getWidevinePssh = (drmInfos: DrmInfos, drmIds: string[]): string | undefined => getDrmData(drmInfos, drmIds, widevine);
const getPlayreadyPssh = (drmInfos: DrmInfos, drmIds: string[]): string | undefined => getDrmData(drmInfos, drmIds, playready);
const getFairplayKey = (drmInfos: DrmInfos, drmIds: string[]): string | undefined => getDrmData(drmInfos, drmIds, fairplay);
