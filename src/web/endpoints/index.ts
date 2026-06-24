import documentation from "./front/documentation.js";
import frontDownload from "./front/download.js";
import frontDownloadAlbum from "./front/downloadAlbum.js";
import frontLogin from "./front/login.js";
import search from "./front/search.js";
export const front = [
    documentation,
    frontDownload,
    frontDownloadAlbum,
    frontLogin,
    search
];

import backDownload from "./back/download.js";
import convertPlaylist from "./back/convertPlaylist.js";
import downloadSegment from "./back/downloadSegment.js";
import downloadAlbum from "./back/downloadAlbum.js";
import getAlbumMetadata from "./back/getAlbumMetadata.js";
import getPlaylistMetadata from "./back/getPlaylistMetadata.js";
import getTrackMetadata from "./back/getTrackMetadata.js";
import backLogin from "./back/login.js";
import logout from "./back/logout.js";
export const back = [
    backDownload,
    convertPlaylist,
    downloadSegment,
    downloadAlbum,
    getAlbumMetadata,
    getPlaylistMetadata,
    getTrackMetadata,
    backLogin,
    logout
];
