import express from "express";
import { z, ZodObject } from "zod";

export async function validate<T extends ZodObject>(req: express.Request, schema: T): Promise<z.infer<T>> {
    const result = await schema.parseAsync(req);
    return result;
}
