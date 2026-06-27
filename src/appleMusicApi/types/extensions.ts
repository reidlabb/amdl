export type AnyAttributesExtensionType = AlbumAttributesExtensionType | PlaylistAttributesExtensionType | SongAttributesExtensionType;
export type AnyAttributesExtensionTypes = AnyAttributesExtensionType[];

// https://developer.apple.com/documentation/applemusicapi/albums/attributes-data.dictionary
export type AlbumAttributesExtensionType = keyof AlbumAttributesExtensionMap;
export type AlbumAttributesExtensionTypes = AlbumAttributesExtensionType[];
export interface AlbumAttributesExtensionMap {
    artistUrl: string;
    audioVariants?: string[];
}

// https://developer.apple.com/documentation/applemusicapi/playlists/attributes-data.dictionary
export type PlaylistAttributesExtensionType = keyof PlaylistAttributesExtensionMap;
export type PlaylistAttributesExtensionTypes = PlaylistAttributesExtensionType[];
export interface PlaylistAttributesExtensionMap {
    trackTypes: string[];
}

// https://developer.apple.com/documentation/applemusicapi/songs/attributes-data.dictionary
export type SongAttributesExtensionType = keyof SongAttributesExtensionMap;
export type SongAttributesExtensionTypes = SongAttributesExtensionType[];
export interface SongAttributesExtensionMap {
    artistUrl: string;
    audioVariants?: string[];
    extendedAssetUrls: {
        plus: string;
        lightweight: string;
        superLightweight: string;
        lightweightPlus: string;
        enhancedHls: string;
    };
}
