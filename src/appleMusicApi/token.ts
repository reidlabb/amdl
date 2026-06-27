import { request } from "undici";
import * as log from "../log.js";
import { appleMusicHomepageUrl } from "../constants/urls.js";

// basically, i don't want to pay 100 dollars for a dev token to the official API
// here's the kicker--this token is more "privileged"
// thanks to this guy complaining to apple for telling us this! https://developer.apple.com/forums/thread/702228
// apple says "any other method may be blocked at any time" (posted in mar 2022, most likely not happening)
async function getToken(baseUrl: string): Promise<string> {
    const indexResponse = await request(baseUrl);
    const indexBody = await indexResponse.body.text();

    const jsRegex = /\/assets\/index(?:-legacy)?[~-][^/]+\.js/;
    const jsPath = indexBody.match(jsRegex)?.[0];

    if (!jsPath) {
        throw new Error("could not match for the index javascript file!");
    }

    const jsResponse = await request(baseUrl + jsPath);
    const jsBody = await jsResponse.body.text();

    // the token is actually a base64-encoded JWT
    // `eyJh` === `{"`, which is the beginning of a JWT. foolproof? no
    const tokenRegex = /eyJ([^"]*)/;
    const token = jsBody.match(tokenRegex)?.[0];

    if (!token) {
        throw new Error("could not find match for the api token in the index javascript file");
    }

    log.info("got api token");

    return token;
}

export const appleMusicApiToken = await (async (): Promise<string> => { try {
    const appleMusicApiToken = await getToken(appleMusicHomepageUrl);
    log.info("logged in to apple music api");
    return appleMusicApiToken;
} catch (err) {
    log.error("failed to login to apple music api!");
    log.error(err);
    process.exit(1);
}})();
