import { ZodError } from "zod";
import { Response } from "express";

/**
 * @param res Express response
 * @param e Any error
 */
export function generalErrorResponse(res: Response, e: unknown) {
    if (e instanceof ZodError) {
        let message = "";
        for (const issue of e.issues) {
            message += `${issue.path.join(".")}: ${issue.message}\n`;
        }
        res.status(400).json({
            ok: false,
            msg: message,
        });
    } else if (e instanceof Error) {
        res.status(400).json({
            ok: false,
            msg: e.message,
        });
    } else {
        res.status(400).json({
            ok: false,
            msg: "Unknown error",
        });
    }
}
