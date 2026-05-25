import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../better-auth";

// For testing: http://localhost:3001/api/auth/ok
let betterAuthRouter = express.Router();
betterAuthRouter.all("/api/auth/*", toNodeHandler(auth));
export { betterAuthRouter };
