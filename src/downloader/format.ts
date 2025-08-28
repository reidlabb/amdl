import type { AlbumAttributes, SongAttributes } from "../appleMusicApi/types/attributes.js";

// TODO: make these configurable, too opinionated right now
// eventually i'll make an account system? maybe you could do through there
// or i'll just make it config on the server

const illegalCharReplacements: Record<string, string> = {
    "?": "？",
    "!": "！",
    "*": "＊",
    "/": "／",
    "\\": "＼",
    ":": "：",
    "\"": "＂",
    "<": "＜",
    ">": "＞",
    "|": "｜"
};

export function stripAlbumGarbage(input: string): string {
    return input.replace(/- (EP|Single)$/, "").trim();
}

export function formatSongForFs(trackAttributes: SongAttributes<[]>): string {
    const title = trackAttributes.name.replace(/[?!*\/\\:"<>|]/g, (match) => illegalCharReplacements[match] || match);
    const disc = trackAttributes.discNumber;
    const track = trackAttributes.trackNumber;

    if (track === undefined) { throw new Error("track number is undefined in track attributes!"); }
    if (disc === undefined) { throw new Error("disc number is undefined in track attributes!"); }

    return `${disc}-${track.toString().padStart(2, "0")} - ${title}`;
}

export function formatAlbumForFs(albumAttributes: AlbumAttributes<[]>): string {
    const artist = albumAttributes.artistName.replace(/[?!*\/\\:"<>|]/g, (match) => illegalCharReplacements[match] || match);
    const album = stripAlbumGarbage(albumAttributes.name).replace(/[?!*\/\\:"<>|]/g, (match) => illegalCharReplacements[match] || match);

    return `${artist} - ${album}`;
}
