import type { Artwork, DescriptionAttribute, EditorialNotes, PlayParameters, Preview } from "./extras.js";
import type {
    AlbumAttributesExtensionMap, AlbumAttributesExtensionTypes,
    PlaylistAttributesExtensionMap, PlaylistAttributesExtensionTypes,
    SongAttributesExtensionMap, SongAttributesExtensionTypes
} from "./extensions.js";

// https://developer.apple.com/documentation/applemusicapi/albums/attributes-data.dictionary
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

// https://developer.apple.com/documentation/applemusicapi/libraryalbums/attributes-data.dictionary
export interface LibraryAlbumAttributes {
    artistName: string;
    artwork: Artwork;
    contentRating?: string;
    dateAdded?: string;
    name: string;
    playParams?: PlayParameters;
    releaseDate?: string;
    trackCount: number;
    genreNames: string[];
    inFavorites?: boolean;
}

// https://developer.apple.com/documentation/applemusicapi/libraryartists/attributes-data.dictionary
export interface LibraryArtistAttributes {
    inFavorites?: boolean;
    name: string;
}

// https://developer.apple.com/documentation/applemusicapi/librarysongs/attributes-data.dictionary
export interface LibrarySongAttributes {
    albumName?: string;
    artistName: string;
    artwork: Artwork;
    contentRating?: string;
    discNumber?: number;
    durationInMillis: number;
    genreNames: string[];
    hasLyrics: boolean;
    inFavorites?: boolean;
    name: string;
    playParams?: PlayParameters;
    releaseDate?: string;
    trackNumber?: number;
};

// https://developer.apple.com/documentation/applemusicapi/playlists/attributes-data.dictionary
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

// https://developer.apple.com/documentation/applemusicapi/songs/attributes-data.dictionary
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
