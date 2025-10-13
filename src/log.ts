import chalk from "chalk";
import util from "node:util";
import path from "node:path";
import process from "node:process";
import callsites from "callsites";
import sourceMapSupport from "source-map-support";
import { fileURLToPath } from "node:url";

sourceMapSupport.install();

enum Level {
    Http,
    Debug,
    Info,
    Warn,
    Error
}

const levelColors = {
    [Level.Http]: chalk.gray,
    [Level.Debug]: chalk.blue,
    [Level.Info]: chalk.green,
    [Level.Warn]: chalk.yellow,
    [Level.Error]: chalk.red
};
const levelNames = {
    [Level.Http]: "HTTP",
    [Level.Debug]: "DEBUG",
    [Level.Info]: "INFO",
    [Level.Warn]: "WARN",
    [Level.Error]: "ERROR"
};

function timePrefix(): string {
    const now = new Date();
    return chalk.gray(now.toISOString());
}
function stackPrefix(): string {
    // little tidbit: this does not work on *some* engines (v8 stack format)
    // i think bun will work, i think deno will not??
    const frame = sourceMapSupport.wrapCallSite(callsites()[3] as sourceMapSupport.CallSite);

    const file = frame.getFileName();
    const line = frame.getLineNumber();
    const column = frame.getColumnNumber();

    if (file === null || line === null || column === null) { return chalk.gray("unknown caller!"); }

    const relative = path.relative(process.cwd(), fileURLToPath(file));
    const parts = relative.split(path.sep);
    const srcIndex = parts.indexOf("src");
    const formatted = srcIndex !== -1
        ? path.join(...parts.slice(srcIndex))
        : relative;

    return chalk.gray(`${formatted}:${line}:${column}`);
}
function levelPrefix(level: Level): string {
    const highestLevelLength = Math.max(...Object.values(levelNames).map(n => n.length));
    const name = levelNames[level];
    const color = levelColors[level];

    return color(name.padStart(highestLevelLength));
}

function format(thing: unknown): string {
    if (typeof thing === "string") {
        return thing;
    } else if (thing instanceof Error) {
        return thing.stack || thing.toString();
    } else {
        // set a decently high depth
        // this is so we can see zod errors in their entirety, for example
        return util.inspect(thing, { colors: true, depth: 10 });
    }
}

function log(level: Level, ...message: unknown[]): void {
    const formatted = message
        .map(m => format(m))
        .reduce((l, r) => l.includes("\n") || r.includes("\n") ? l + "\n" + r : l + " " + r, "")
        .trim();
    const prefix = `${timePrefix()} ${levelPrefix(level)} ${stackPrefix()}`;
    process.stdout.write(`${prefix} ${formatted.split("\n").join("\n" + prefix)}\n`);
}

export function http(...message: unknown[]): void { log(Level.Http, ...message); }
export function debug(...message: unknown[]): void { log(Level.Debug, ...message); }
export function info(...message: unknown[]): void { log(Level.Info, ...message); }
export function warn(...message: unknown[]): void { log(Level.Warn, ...message); }
export function error(...message: unknown[]): void { log(Level.Error, ...message); }

// custom interceptors for uncaught exceptions and unhandled rejections
// additionally, also wrap warnings (but, make the experimental warning shut up)
process.on("uncaughtException", (err) => {
    error("uncaught exception!");
    error(err);
    process.exit(1);
});
process.on("unhandledRejection", (err) => {
    error("unhandled rejection!");
    error(err);
    process.exit(1);
});
process.removeAllListeners("warning");
process.on("warning", (err) => {
    if (err.name === "ExperimentalWarning") { return; }
    warn(err);
});
