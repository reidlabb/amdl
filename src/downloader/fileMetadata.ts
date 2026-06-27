import type { GetSongResponse } from "../appleMusicApi/types/responses.js";
import { stripAlbumGarbage } from "./format.js";

// TODO: simply add more fields. ha!
// TODO: add lyrics (what format??)
// TODO: where it does file name formatting to hit caches, i think we should normalize this throughout files in a function
// TODO: bring back compilation and copyright
export class FileMetadata {
    public readonly artist: string;
    public readonly title: string;
    public readonly album: string;
    public readonly albumArtist: string;
    public readonly isPartOfCompilation?: boolean;
    public readonly track?: number;
    public readonly disc?: number;
    public readonly date?: string;
    public readonly copyright?: string;
    public readonly isrc?: string;
    public readonly composer?: string;

    private constructor(
        artist: string,
        title: string,
        album: string,
        albumArtist: string,
        // isPartOfCompilation?: boolean,
        track?: number,
        disc?: number,
        date?: string,
        // copyright?: string,
        isrc?: string,
        composer?: string
    ) {
        this.artist = artist;
        this.title = title;
        this.album = stripAlbumGarbage(album);
        this.albumArtist = albumArtist;
        // this.isPartOfCompilation = isPartOfCompilation;
        this.track = track;
        this.disc = disc;
        this.date = date;
        // this.copyright = copyright;
        this.isrc = isrc;
        this.composer = composer;
    }

    public static fromSongResponse(trackMetadata: GetSongResponse<[], ["albums"]>): FileMetadata {
        const trackAttributes = trackMetadata.data[0].attributes;
        const albumAttributes = trackMetadata.data[0].relationships.albums.data[0].attributes;

        return new FileMetadata(
            trackAttributes.artistName,
            trackAttributes.name,
            albumAttributes.name,
            albumAttributes.artistName,
            // albumAttributes.isCompilation,
            trackAttributes.trackNumber,
            trackAttributes.discNumber,
            trackAttributes.releaseDate,
            // albumAttributes?.copyright,
            trackAttributes.isrc,
            trackAttributes.composerName
        );
    }

    public async setupFfmpegInputs(audioInput: string): Promise<string[]> {
        return [
            "-i", audioInput,
            "-c:a", "copy"
        ];
    }

    public async toFfmpegArgs(): Promise<string[]> {
        return [
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
            // ...(this.copyright !== undefined ? ["-metadata", "copyright=" + this.copyright] : []),
            ...(this.isrc !== undefined ? ["-metadata", "isrc=" + this.isrc] : []),
            ...(this.composer !== undefined ? ["-metadata", "composer=" + this.composer] : []),
            // from https://id3.org/Developer%20Information:
            // > TCMP: iTunes Compilation flag
            // > TSO2: iTunes uses this for Album Artist sort order
            // > TSOC: iTunes uses this for Composer sort order
            // "-metadata", "TCMP=" + (this.isPartOfCompilation ? "1" : "0"),
            "-metadata", "TSO2=" + this.albumArtist,
            "-metadata", "TSOC=" + this.composer
        ];
    }
}
