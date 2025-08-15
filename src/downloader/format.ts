import type { SongAttributes } from "../appleMusicApi/types/attributes.js";

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

// TODO: make these configurable, too opinionated right now
// eventually i'll make an account system? maybe you could do through there
// or i'll just make it config on the server
export function formatSong(trackAttributes: SongAttributes<[]>): string {
    const title = trackAttributes.name.replace(/[?!*\/\\:"<>|]/g, (match) => illegalCharReplacements[match] || match);
    const disc = trackAttributes.discNumber;
    const track = trackAttributes.trackNumber;

    if (track === undefined) { throw new Error("track number is undefined in track attributes!"); }
    if (disc === undefined) { throw new Error("disc number is undefined in track attributes!"); }

    return `${disc}-${track.toString().padStart(2, "0")} - ${title}`;
}
