import { createDocument } from "zod-openapi";
import packageJson from "../../package.json" with { type: "json" };

// i hate doing this
// classic maneuver tho!
type OpenAPIObject = ReturnType<typeof createDocument>;
type ZodOpenApiPathsObject = NonNullable<Parameters<typeof createDocument>[0]["paths"]>;

export const paths: ZodOpenApiPathsObject = {};

// this seems a little race-conditiony
// but, it's actually pretty safe! in the web index file, we call createOpenApiDocument
// after all routes are registered, so this will be populated by then (then being serving)
export let doc: OpenAPIObject;

export function createOpenApiDocument(): void {
    doc = createDocument({
        openapi: "3.1.1", // most recent at the time of writing
        info: {
            title: packageJson.name,
            version: packageJson.version,
            description: packageJson.description,
            contact: {
                name: "reidlab",
                url: "https://reidlab.pink/socials"
            }
        },
        servers: [{
            url: "/api"
        }],
        paths: {
            ...paths
        }
    });
}
