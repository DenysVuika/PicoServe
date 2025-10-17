import { Express, Request, Response } from "express";
import { PluginConfig } from "./types";

/**
 * App Config API plugin
 * Provides an example dynamic app.config.json endpoint that can be overridden by a plugin
 */
export default function (app: Express, config: PluginConfig) {
  app.get("/app.config.json", (req: Request, res: Response) => {
    res.json({
      name: "App Config",
      version: "1.0.0",
      description: "App Config Description",
      staticPath: config.staticPath,
      staticDir: config.staticDir,
      port: config.port,
    });
  });

  console.log("    - Registered: GET /app.config.json");
}
