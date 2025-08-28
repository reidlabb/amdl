import { defineConfig } from "drizzle-kit";
import toml from "toml";
import fs from "fs";

export default defineConfig({
    out: "./drizzle", // TODO: unhardcode
    schema: "./src/database/schema.ts",
    dialect: "sqlite",
    dbCredentials: {
        url: toml.parse(fs.readFileSync("config.toml", "utf-8")).downloader.cache.database // TODO: unscuff
    }
});
