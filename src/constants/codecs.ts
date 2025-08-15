import type { RegularCodecType } from "downloader/codecType.js";

export const songCodecRegex: Record<RegularCodecType, RegExp> = {
    "aac": /audio-stereo-\d+/,
    "aac_he": /audio-HE-stereo-\d+/,
    "aac_binaural": /audio-stereo-\d+-binaural/,
    "aac_downmix": /audio-stereo-\d+-downmix/,
    "aac_he_binaural": /audio-HE-stereo-\d+-binaural/,
    "aac_he_downmix": /audio-HE-stereo-\d+-downmix/,
    "atmos": /audio-atmos-.*/,
    "ac3": /audio-ac3-.*/,
    "alac": /audio-alac-.*/
};
