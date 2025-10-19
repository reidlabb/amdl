import path from "node:path";
import { config } from "./config.js";
import { db } from "./database/index.js";
import { fileCacheTable, keyCacheTable } from "./database/schema.js";
import fsPromises from "fs/promises";
import { and, eq } from "drizzle-orm";
import * as log from "./log.js";
import prettyBytes from "pretty-bytes";
import process from "node:process";

// try creating cache if it doesn't exist
// a bit scuffed but that ok
try {
    log.debug(`ensuring cache directory "${config.downloader.cache.directory}" exists`);
    await fsPromises.mkdir(config.downloader.cache.directory, { recursive: true });
} catch (err) {
    log.error("failed to create cache directory!");
    log.error(err);
    process.exit(1);
}

const fileTtl = config.downloader.cache.file_ttl * 1000;
const timers = new Map<string, NodeJS.Timeout>();

try {
    let entriesCleared = 0;
    let entriesClearedBytes = 0;
    log.debug("cache cleanup and expiry timers starting");

    const results = await Promise.all((await db.select().from(fileCacheTable)).map(async ({ name, expiry }) => {
        if (expiry < Date.now()) {
            return await dropFile(name);
        } else {
            await scheduleDeletion(name, expiry);
        }
    }));

    for (const result of results) {
        if (result !== undefined) {
            entriesCleared += 1;
            entriesClearedBytes += result;
        }
    }

    log.debug("cache cleanup complete!");
    log.debug(`cleared ${entriesCleared} entr${entriesCleared === 1 ? "y" : "ies"}, freeing up ${prettyBytes(entriesClearedBytes)}!`);
} catch (err) {
    log.error("failed to run cache cleanup!");
    log.error(err);
}

async function scheduleDeletion(name: string, expiry: number): Promise<void> {
    if (timers.has(name)) {
        clearTimeout(timers.get(name) as NodeJS.Timeout);
    }

    const timeout = setTimeout(async () => {
        await dropFile(name);
        timers.delete(name);
    }, expiry - Date.now());

    timers.set(name, timeout);
}

// TODO: add behavior toggle: should we keep it in the database on failure or not ??
// current behavior: delete from db first, then try deleting files
// this is good if manual cleanup was already done (we can then ignore ENOENT)
// bad if they change the permissions instead of manual removal
async function dropFile(name: string): Promise<number | undefined> {
    try {
        await db.delete(fileCacheTable).where(eq(fileCacheTable.name, name));
        const size = (await fsPromises.stat(path.join(config.downloader.cache.directory, name))).size;
        await fsPromises.unlink(path.join(config.downloader.cache.directory, name));

        log.debug(`deleted file ${name} from cache, freeing up ${prettyBytes(size)}`);

        return size;
    } catch (err) {
        if (err instanceof Error && err.message.includes("ENOENT")) { return; }

        log.error(`failed to delete cached file ${name} for whatever reason!`);
        log.error("manual removal may be necessary!");
        log.error(err);
    }
}

export async function addFileToCache(fileName: string): Promise<void> {
    const expiry = Date.now() + fileTtl;
    const existing = await db.select().from(fileCacheTable).where(eq(fileCacheTable.name, fileName)).get();

    if (existing) {
        await db.update(fileCacheTable).set({ expiry: expiry }).where(eq(fileCacheTable.name, fileName));
        await scheduleDeletion(fileName, expiry);
    } else {
        await db.insert(fileCacheTable).values({name: fileName, expiry: expiry });
        await scheduleDeletion(fileName, expiry);
    }
}

export async function isFileCached(fileName: string): Promise<boolean> {
    const existing = await db.select().from(fileCacheTable).where(eq(fileCacheTable.name, fileName)).get();

    if (existing !== undefined) {
        await db.update(fileCacheTable).set({ expiry: Date.now() + fileTtl }).where(eq(fileCacheTable.name, fileName));
        await scheduleDeletion(fileName, existing.expiry);

        log.debug(`cache HIT for file ${fileName}, extending expiry`);
        return true;
    } else {
        log.debug(`cache MISS for file ${fileName}`);
        return false;
    }
}

// TODO: add a key ttl? its probably not necessary but would be a nice to have
// its pretty small anyway
export async function addKeyToCache(songId: string, codec: string, decryptionKey: string): Promise<void> {
    const existing = await db.select().from(keyCacheTable).where(and(
        eq(keyCacheTable.songId, songId),
        eq(keyCacheTable.codec, codec),
        eq(keyCacheTable.decryptionKey, decryptionKey)
    )).get();

    if (existing) {
        return;
    } else {
        await db.insert(keyCacheTable).values({ songId: songId, codec: codec, decryptionKey: decryptionKey });
    }
}

export async function getKeyFromCache(songId: string, codec: string): Promise<string | undefined> {
    const existing = await db.select().from(keyCacheTable).where(and(
        eq(keyCacheTable.songId, songId),
        eq(keyCacheTable.codec, codec)
    )).get();

    if (existing !== undefined) {
        log.debug(`cache HIT for key of ${songId} (${codec})`);
        return existing.decryptionKey;
    } else {
        log.debug(`cache MISS for key of ${songId} (${codec})`);
        return undefined;
    }
}
