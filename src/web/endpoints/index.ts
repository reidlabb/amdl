import documentation from "./front/documentation.js";
import frontDownload from "./front/download.js";
import search from "./front/search.js";
export const front = [
    documentation,
    frontDownload,
    search
];

import backDownload from "./back/download.js";
import getAlbumMetadata from "./back/getAlbumMetadata.js";
import getPlaylistMetadata from "./back/getPlaylistMetadata.js";
import getTrackMetadata from "./back/getTrackMetadata.js";
export const back = [
    backDownload,
    getAlbumMetadata,
    getPlaylistMetadata,
    getTrackMetadata
];
