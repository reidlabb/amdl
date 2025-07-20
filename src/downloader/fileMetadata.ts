import { createWriteStream } from "node:fs";
import type { GetSongResponse } from "appleMusicApi/types/responses.js";
import path from "node:path";
import { config } from "../config.js";
import { pipeline } from "node:stream/promises";
import { addToCache, isCached } from "../cache.js";

// TODO: simply add more fields. ha!
// TODO: add album cover
// TODO: add lyrics (what format??)
export class FileMetadata {
    public readonly artist: string;
    public readonly title: string;
    public readonly album: string;
    public readonly albumArtist: string;
    public readonly isPartOfCompilation: boolean;
    public readonly artwork: string;
    public readonly track?: number;
    public readonly disc?: number;
    public readonly date?: string;
    public readonly copyright?: string;
    public readonly isrc?: string;
    public readonly composer?: string;

    constructor(
        artist: string,
        title: string,
        album: string,
        albumArtist: string,
        isPartOfCompilation: boolean,
        artwork: string,
        track?: number,
        disc?: number,
        date?: string,
        copyright?: string,
        isrc?: string,
        composer?: string
    ) {
        this.artist = artist;
        this.title = title;
        this.album = album.replace(/- (EP|Single)$/, "").trim();
        this.albumArtist = albumArtist;
        this.isPartOfCompilation = isPartOfCompilation;
        this.artwork = artwork;
        this.track = track;
        this.disc = disc;
        this.date = date;
        this.copyright = copyright;
        this.isrc = isrc;
        this.composer = composer;
    }

    public static fromSongResponse(trackMetadata: GetSongResponse<["extendedAssetUrls"], ["albums"]>): FileMetadata {
        const trackAttributes = trackMetadata.data[0].attributes;
        const albumAttributes = trackMetadata.data[0].relationships.albums.data[0].attributes;

        const artworkUrl = trackAttributes.artwork.url
            .replace("{w}", trackAttributes.artwork.width.toString())
            .replace("{h}", trackAttributes.artwork.height.toString());

        return new FileMetadata(
            trackAttributes.artistName,
            trackAttributes.name,
            albumAttributes.name,
            albumAttributes.artistName,
            albumAttributes.isCompilation,
            artworkUrl,
            trackAttributes.trackNumber,
            trackAttributes.discNumber,
            trackAttributes.releaseDate,
            albumAttributes.copyright,
            trackAttributes.isrc,
            trackAttributes.composerName
        );
    }

    public async setupFfmpegInputs(encryptedPath: string): Promise<string[]> {
        // url is in a weird format
        // only things we care about is the uuid and file extension i think?
        // i dont wanna use the original file name because what if. what if theres a collision
        const extension = this.artwork.slice(this.artwork.lastIndexOf(".") + 1);
        const uuid = this.artwork.split("/").at(-3);

        if (uuid === undefined) { throw new Error("could not get uuid from artwork url!"); }

        const imageFileName = `${uuid}.${extension}`;
        const imagePath = path.join(config.downloader.cache.directory, imageFileName);

        if (!isCached(imageFileName)) {
            const response = await fetch(this.artwork);

            if (!response.ok) { throw new Error(`failed to fetch artwork: ${response.status}`); }
            if (!response.body) { throw new Error("no response body for artwork!"); }

            await pipeline(response.body as ReadableStream, createWriteStream(imagePath));

            addToCache(imageFileName);
        }

        return [
            "-i", encryptedPath,
            "-i", imagePath,
            "-map", "0",
            "-map", "1",
            "-c:a", "copy",
            "-c:v", "mjpeg"
        ];
    }

    public async toFfmpegArgs(): Promise<string[]> {
        return [
            // standard album cover metadata
            "-metadata:s:v","comment='Cover (front)'",
            // bog standard metadata
            "-metadata", "artist=" + this.artist,
            "-metadata", "title=" + this.title,
            "-metadata", "album=" + this.album,
            "-metadata", "album_artist=" + this.albumArtist,
            // oh how i'd love to do <track>/<totaltracks> but...
            // it feels weird only doing it on tracks, since MZ doesn't have total disks
            // so i'm just doing non-full numbers because it feels weird only doing it for one
            ...(this.track !== undefined ? ["-metadata", "track=" + this.track] : []),
            ...(this.disc !== undefined ? ["-metadata", "disc=" + this.disc] : []),
            ...(this.date !== undefined ? ["-metadata", "date=" + this.date] : []),
            ...(this.copyright !== undefined ? ["-metadata", "copyright=" + this.copyright] : []),
            ...(this.isrc !== undefined ? ["-metadata", "isrc=" + this.isrc] : []),
            ...(this.composer !== undefined ? ["-metadata", "composer=" + this.composer] : []),
            // from https://id3.org/Developer%20Information:
            // > TCMP: iTunes Compilation flag
            // > TSO2: iTunes uses this for Album Artist sort order
            // > TSOC: iTunes uses this for Composer sort order
            "-metadata", "TCMP=" + (this.isPartOfCompilation ? "1" : "0"),
            "-metadata", "TSO2=" + this.albumArtist,
            "-metadata", "TSOC=" + this.composer
        ];
    }
}
