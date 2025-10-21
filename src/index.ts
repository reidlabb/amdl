import { config } from "./config.js";
import process from "node:process";
import * as log from "./log.js";
import { appleMusicApi } from "./appleMusicApi/index.js";
import { app } from "./web/index.js";
// @ts-expect-error: cacheStores should exist--it does not
// TODO: file an issue on undici and remove this when fixed
// DONE: issue filed... https://github.com/nodejs/undici/issues/4614
// OKAY: it was "resolved". just have to wait for the next release
import { Agent, interceptors, setGlobalDispatcher, cacheStores } from "undici";

setGlobalDispatcher(new Agent().compose([
    interceptors.responseError(),
    interceptors.redirect(),
    interceptors.decompress(),
    // TODO: configurable cache sizes?
    // these values are pretty nice for non-binary (lol) data
    interceptors.cache({ store: new cacheStores.MemoryCacheStore({
        maxSize: 50 * 1024 * 1024, // 50mb
        maxCount: 1000,
        maxEntrySize: 5 * 1024 // 5kb
    })})
]));

try {
    await appleMusicApi.login();
    log.info("logged in to apple music api");
} catch (err) {
    log.error("failed to login to apple music api!");
    log.error(err);
    process.exit(1);
}

try {
    const listener = app.listen(config.server.port, () => {
        const address = listener.address();

        // okay, afaik, this is (theoretically) completely unreachable
        // if you're listening, you have to have an address
        if (address === null) { process.exit(1); }

        else if (typeof address === "string") { log.info(`hosting on unix://${address}`); }
        else { log.info(`hosting on http://localhost:${address.port}`); }
    });
} catch (err) {
    log.error("failed to start server!");
    log.error(err);
    process.exit(1);
}
