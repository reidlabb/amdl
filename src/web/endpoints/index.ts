import documentation from "./front/documentation.js";
import frontDownload from "./front/download.js";
import frontDownloadAlbum from "./front/downloadAlbum.js";
import search from "./front/search.js";
export const front = [
    documentation,
    frontDownload,
    frontDownloadAlbum,
    search
];

import backDownload from "./back/download.js";
import convertPlaylist from "./back/convertPlaylist.js";
import downloadSegment from "./back/downloadSegment.js";
import downloadAlbum from "./back/downloadAlbum.js";
import getAlbumMetadata from "./back/getAlbumMetadata.js";
import getPlaylistMetadata from "./back/getPlaylistMetadata.js";
import getTrackMetadata from "./back/getTrackMetadata.js";
export const back = [
    backDownload,
    convertPlaylist,
    downloadSegment,
    downloadAlbum,
    getAlbumMetadata,
    getPlaylistMetadata,
    getTrackMetadata
];
