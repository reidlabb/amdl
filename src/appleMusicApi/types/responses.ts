// this is a semi-reverse engineered type definition set for the apple music API
// I WILL NOT ADD "VIEWS" THEY ARE NOT REAL
// [scoping parameters](https://developer.apple.com/documentation/applemusicapi/handling-resource-representation-and-relationships) assume that we pass down all of the extensions through, this must be reflected in the usage of the api
// there is a small chance i will add more endpoints

import type { AlbumAttributes, LibrarySongAttributes, SongAttributes } from "./attributes.js";
import type { AlbumAttributesExtensionTypes, AnyAttributesExtensionTypes, SongAttributesExtensionTypes } from "./extensions.js";
import type { Relationship, RelationshipType, RelationshipTypeMap, RelationshipTypes } from "./relationships.js";

// https://developer.apple.com/documentation/applemusicapi/get-a-catalog-album
export interface GetAlbumResponse<
    T extends AlbumAttributesExtensionTypes,
    U extends RelationshipTypes<T>
> {
    // https://developer.apple.com/documentation/applemusicapi/albums
    data: {
        id: string;
        type: "albums";
        href: string;
        // https://developer.apple.com/documentation/applemusicapi/albums/attributes-data.dictionary
        attributes: AlbumAttributes<T>;
        // https://developer.apple.com/documentation/applemusicapi/albums/relationships-data.dictionary
        relationships: {
            [K in U[number]]: Relationship<
                K extends RelationshipType<T> ? RelationshipTypeMap<T>[K] : never
            >
        };
    }[];
}

// https://developer.apple.com/documentation/applemusicapi/get-all-library-songs
export interface GetLibrarySongsResponse<
    // https://developer.apple.com/documentation/applemusicapi/librarysongs/relationships-data.dictionary
    // TODO: implement "catalog"
    T extends [],
    U extends RelationshipTypes<T>
> {
    // https://developer.apple.com/documentation/applemusicapi/librarysongs
    data: {
        id: string;
        type: "library-songs";
        href: string;
        // https://developer.apple.com/documentation/applemusicapi/librarysongs/attributes-data.dictionary
        attributes: LibrarySongAttributes;
        // https://developer.apple.com/documentation/applemusicapi/librarysongs/relationships-data.dictionary
        relationships: {
            [K in U[number]]: Relationship<
                K extends RelationshipType<T> ? RelationshipTypeMap<T>[K] : never
            >
        };
    }[];
}

// https://developer.apple.com/documentation/applemusicapi/get-a-catalog-playlist
export interface GetPlaylistResponse<
    T extends SongAttributesExtensionTypes,
    U extends RelationshipTypes<T>
> {
    // https://developer.apple.com/documentation/applemusicapi/playlists
    data: {
        id: string;
        type: "playlists";
        href: string;
        // https://developer.apple.com/documentation/applemusicapi/playlists/attributes-data.dictionary
        attributes: SongAttributes<T>;
        // https://developer.apple.com/documentation/applemusicapi/playlists/relationships-data.dictionary
        relationships: {
            [K in U[number]]: Relationship<
                K extends RelationshipType<T> ? RelationshipTypeMap<T>[K] : never
            >
        };
    }[];
}

// https://developer.apple.com/documentation/applemusicapi/get-a-catalog-song
export interface GetSongResponse<
    T extends SongAttributesExtensionTypes,
    U extends RelationshipTypes<T>
> {
    // https://developer.apple.com/documentation/applemusicapi/songs
    data: {
        id: string;
        type: "songs";
        href: string;
        // https://developer.apple.com/documentation/applemusicapi/songs/attributes-data.dictionary
        attributes: SongAttributes<T>;
        // https://developer.apple.com/documentation/applemusicapi/songs/relationships-data.dictionary
        relationships: {
            [K in U[number]]: Relationship<
                K extends RelationshipType<T> ? RelationshipTypeMap<T>[K] : never
            >
        };
    }[];
}

// TODO: support more than just albums
// TODO: figure out how to only get *some* attributes, rn i just hardcode albums
// TODO: dedupe when done above ^
// requires changing impl of search function in appleMusicApi.ts, guh !
// https://developer.apple.com/documentation/applemusicapi/searchresponse
export interface SearchResponse<
    T extends AnyAttributesExtensionTypes,
    U extends RelationshipTypes<T>
> {
    // https://developer.apple.com/documentation/applemusicapi/searchresponse/results-data.dictionary
    results: {
        // https://developer.apple.com/documentation/applemusicapi/searchresponse/results-data.dictionary/albumssearchresult
        albums?: {
            // https://developer.apple.com/documentation/applemusicapi/albums
            data: {
                id: string;
                type: "albums";
                href: string;
                attributes: AlbumAttributes<Extract<T, AlbumAttributesExtensionTypes>>;
                // https://developer.apple.com/documentation/applemusicapi/albums/relationships-data.dictionary
                relationships: {
                    [K in U[number]]: Relationship<
                        K extends RelationshipType<T> ? RelationshipTypeMap<T>[K] : never
                    >
                };
            }[];
            href?: string;
            next?: string;
        };
    };
}
