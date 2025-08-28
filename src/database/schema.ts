import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const fileCacheTable = sqliteTable("file_cache", {
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    expiry: int().notNull()
});

export const keyCacheTable = sqliteTable("key_cache", {
    id: int().primaryKey({ autoIncrement: true }),
    songId: text().notNull(),
    codec: text().notNull(),
    decryptionKey: text().notNull()
});
