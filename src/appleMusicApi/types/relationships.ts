// you will shit yourself if you don't read this:
// required reading: https://developer.apple.com/documentation/applemusicapi/handling-resource-representation-and-relationships

import type { AlbumAttributes, PlaylistAttributes, SongAttributes } from "./attributes.js";
import type { AlbumAttributesExtensionTypes, AnyAttributesExtensionTypes, PlaylistAttributesExtensionTypes, SongAttributesExtensionTypes } from "./extensions.js";

// TODO: have something like this for every resource
export interface Relationship<T> {
    href?: string;
    next?: string;
    data: {
        // TODO: there is extra types here (id, type, etc) i just can't cba to add them lol
        // probably not important ! ahahahah
        // seems to be the same basic "resource" pattern i'm starting to notice (id(?), href, type, meta (not included), etc)
        attributes: T;
    }[];
}

export type RelationshipType<T extends AnyAttributesExtensionTypes> = keyof RelationshipTypeMap<T>;
export type RelationshipTypes<T extends AnyAttributesExtensionTypes> = RelationshipType<T>[];
export interface RelationshipTypeMap<T extends AnyAttributesExtensionTypes> {
    albums: AlbumAttributes<Extract<T, AlbumAttributesExtensionTypes>>;
    // TODO: from what i can tell, playlists can NOT be used as a relationship type? kept in case
    playlists: PlaylistAttributes<Extract<T, PlaylistAttributesExtensionTypes>>;
    // TODO: tracks can also be music videos, uh oh.
    tracks: SongAttributes<Extract<T, SongAttributesExtensionTypes>>;
}
