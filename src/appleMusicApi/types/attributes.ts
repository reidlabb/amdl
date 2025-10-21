import type { Artwork, DescriptionAttribute, EditorialNotes, PlayParameters, Preview } from "./extras.js";
import type {
    AlbumAttributesExtensionMap, AlbumAttributesExtensionTypes,
    PlaylistAttributesExtensionMap, PlaylistAttributesExtensionTypes,
    SongAttributesExtensionMap, SongAttributesExtensionTypes
} from "./extensions.js";

export type AlbumAttributes<
    T extends AlbumAttributesExtensionTypes
> = {
    artistName: string;
    artwork: Artwork;
    contentRating?: string;
    copyright?: string;
    editorialNotes?: EditorialNotes;
    genreNames: string[];
    isCompilation: boolean;
    isComplete: boolean;
    isMasteredForItunes: boolean;
    isSingle: boolean;
    name: string;
    playParams?: PlayParameters;
    recordLabel?: string;
    releaseDate?: string;
    trackCount: number;
    upc?: string;
    url: string;
}
    & Pick<AlbumAttributesExtensionMap, T[number]>;

export type PlaylistAttributes<
    T extends PlaylistAttributesExtensionTypes
> = {
    artwork?: Artwork;
    curatorName: string;
    description?: DescriptionAttribute;
    isChart: boolean;
    lastModifiedDate?: string;
    name: string;
    playlistType: string;
    playParams?: PlayParameters;
    url: string;
}
    & Pick<PlaylistAttributesExtensionMap, T[number]>;

export type SongAttributes<
    T extends SongAttributesExtensionTypes
> = {
    albumName: string;
    artistName: string;
    artwork: Artwork;
    attribution?: string;
    composerName?: string;
    contentRating?: string;
    discNumber?: number;
    // >claims to be required
    // >not present sometimes ??
    durationInMillis?: number;
    editorialNotes?: EditorialNotes;
    genreNames: string[];
    hasLyrics: boolean;
    isAppleDigitalMaster: boolean;
    isrc?: string;
    movementCount?: number;
    movementName?: string;
    movementNumber?: number;
    name: string;
    playParams?: PlayParameters;
    previews: Preview[];
    releaseDate?: string;
    trackNumber?: number;
    url: string;
    workName?: string;
}
    & Pick<SongAttributesExtensionMap, T[number]>;
