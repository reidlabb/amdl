// https://developer.apple.com/documentation/applemusicapi/descriptionattribute
export interface DescriptionAttribute {
    short?: string;
    standard: string;
}

// https://developer.apple.com/documentation/applemusicapi/artwork
export interface Artwork {
    bgColor?: string;
    height: number;
    width: number;
    textColor1?: string;
    textColor2?: string;
    textColor3?: string;
    textColor4?: string;
    url: string;
}

// https://developer.apple.com/documentation/applemusicapi/editorialnotes
export interface EditorialNotes {
    short?: string;
    standard?: string;
    name?: string;
    tagline?: string;
}

// https://developer.apple.com/documentation/applemusicapi/playparameters
export interface PlayParameters {
    id: string;
    kind: string;
}

// https://developer.apple.com/documentation/applemusicapi/preview
export interface Preview {
    artwork?: Artwork;
    url: string;
    hlsUrl?: string;
}
