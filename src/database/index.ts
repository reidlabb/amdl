import { createClient } from "@libsql/client";
import { config, env } from "../config.js";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fsPromises from "fs/promises";
import * as log from "../log.js";

try {
    if (config.downloader.cache.database.startsWith("file:")) {
        const databaseDir = config.downloader.cache.database.split("file:")[1].split("/").slice(0, -1).join("/");
        log.debug(`ensuring database directory "${databaseDir}" exists`);
        await fsPromises.mkdir(databaseDir, { recursive: true });
    }
} catch (err) {
    log.error("failed to create database directory!");
    log.error(err);
    process.exit(1);
}

// TODO: nice looking errors
export const client = createClient({ url: config.downloader.cache.database });
client.execute("PRAGMA foreign_keys = ON;");
client.execute("PRAGMA journal_mode = WAL;");
export const db = drizzle(config.downloader.cache.database);

await migrate(db, { migrationsFolder: env.MIGRATIONS_DIR });
