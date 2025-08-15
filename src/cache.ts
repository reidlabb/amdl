import fs from "node:fs";
import path from "node:path";
import timeago from "timeago.js";
import { config } from "./config.js";
import * as log from "./log.js";

// DO NOT READ FURTHER INTO THIS FILE
// COGNITIVE DISSONANCE WARNING

// TODO: hourly cache reports
// TODO: swap to sqlite
// TODO: make async fs calls
// TODO: rework EVERYTHING
// TODO: refresh cache timer on download

interface CacheEntry {
    fileName: string;
    expiry: number; // milliseconds, not seconds
}

const cacheTtl = config.downloader.cache.ttl * 1000;
const cacheFile = path.join(config.downloader.cache.directory, "cache.json");

if (!fs.existsSync(config.downloader.cache.directory)) {
    log.debug("cache directory not found, creating it");
    fs.mkdirSync(config.downloader.cache.directory, { recursive: true });
}
if (!fs.existsSync(cacheFile)) {
    log.debug("cache file not found, creating it");
    fs.writeFileSync(cacheFile, JSON.stringify([]), { encoding: "utf-8" });
}

let cache = JSON.parse(fs.readFileSync(cacheFile, { encoding: "utf-8" })) as CacheEntry[];

// TODO: change how this works
// this is so uncomfy
cache.push = function(...items: CacheEntry[]): number {
    for (const entry of items) {
        log.debug(`cache entry ${entry.fileName} added, expires ${timeago.format(entry.expiry)}`);
        setTimeout(() => {
            log.debug(`cache entry ${entry.fileName} expired, cleaning`);
            removeCacheEntry(entry.fileName);
            rewriteCache();
        }, entry.expiry - Date.now());
    }

    return Array.prototype.push.apply(this, items);
};

function rewriteCache(): void {
    // cache is in fact []. i checked
    fs.writeFileSync(cacheFile, JSON.stringify(cache), { encoding: "utf-8" });
}

function removeCacheEntry(fileName: string): void {
    cache = cache.filter((entry) => { return entry.fileName !== fileName; });
    try {
        fs.unlinkSync(path.join(config.downloader.cache.directory, fileName));
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            log.debug(`file for cache entry ${fileName} missing, dropping`);
        } else {
            log.error(`could not remove cache entry ${fileName}!`);
            log.error(err);
        }
    }
}

// clear cache entries that are expired
// this is for when the program is killed when cache entries are present
// those could expire while the program is not running, therefore not being cleaned
let expiryLogPrinted = false;
for (const entry of cache) {
    if (entry.expiry < Date.now()) {
        if (!expiryLogPrinted) { log.info("old expired cache entries are present, cleaning them"); }
        expiryLogPrinted = true;
        log.debug(`cache entry ${entry.fileName} expired ${timeago.format(entry.expiry)}; cleaning`);
        removeCacheEntry(entry.fileName);
        rewriteCache();
    }
}

export function isCached(fileName: string): boolean {
    const entry = cache.find((e) => { return e.fileName === fileName; });
    const cached = entry !== undefined && entry.expiry > Date.now();
    if (cached) { log.debug(`cache HIT for ${fileName}`); }
    else { log.debug(`cache MISS for ${fileName}`); }
    return cached;
}

export function addToCache(fileName: string): void {
    cache.push({
        fileName: fileName,
        expiry: Date.now() + cacheTtl
    });
    rewriteCache();
}
