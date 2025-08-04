import fs from "node:fs";
import * as log from "./log.js";
import toml from "toml";
import { z, ZodError, ZodObject } from "zod";
import * as dotenv from "dotenv";
import { fromZodError } from "zod-validation-error";

dotenv.config({ quiet: true });

const configSchema = z.object({
    server: z.object({
        port: z.number().int().min(0).max(65535).or(z.string()),
        frontend: z.object({
            search_count: z.number().int().min(5).max(25),
            displayed_codecs: z.array(z.string())
        })
    }),
    downloader: z.object({
        ffmpeg_path: z.string(),
        ytdlp_path: z.string(),
        cache: z.object({
            directory: z.string(),
            ttl: z.number().int().min(0)
        }),
        api: z.object({
            language: z.string()
        })
    })
});

const envSchema = z.object({
    MEDIA_USER_TOKEN: z.string(),
    ITUA: z.string(),
    WIDEVINE_CLIENT_ID: z.string(),
    WIDEVINE_PRIVATE_KEY: z.string(),
    VIEWS_DIR: z.string().default("./views"),
    PUBLIC_DIR: z.string().default("./public")
});

// check that `config.toml` actually exists
// if `config.example.toml` doesn't exist(?), error out
// if `config.toml` doesn't exist, copy over `comfig.example.toml` to `config.toml`
export let defaultConfig = false;
if (!fs.existsSync("config.toml")) {
    if (!fs.existsSync("config.example.toml")) {
        log.error("no available config file!");
        process.exit(1);
    }
    log.warn("config.toml not found, copying over config.example.toml");
    log.warn("using default config; this may result in unexpected behavior!");
    fs.copyFileSync("config.example.toml", "config.toml");
    defaultConfig = true;
}

/**
 * @param schema the zod schema to use
 * @param something the thing to load the schema from--either a **file path to a toml file** or **an object** (e.g. process.env)
 * @returns the inferred type of the schema
 */
function loadSchemaSomething<T extends ZodObject>(schema: T, something: string | unknown): z.infer<T> {
    try {
        if (typeof something === "string") {
            return schema.parse(toml.parse(fs.readFileSync(something, "utf-8")));
        } else {
            return schema.parse(something);
        }
    } catch (err) {
        // zod errors are kind of Ugly by default
        // this will make it look (a little) better for the end user
        if (err instanceof ZodError) { err = fromZodError(err); }

        log.error("error loading schema");
        log.error(err);
        process.exit(1);
    }
}

export const config = loadSchemaSomething(configSchema, "config.toml");
log.info("config loaded");
export const env = loadSchemaSomething(envSchema, process.env);
log.info("env loaded");
