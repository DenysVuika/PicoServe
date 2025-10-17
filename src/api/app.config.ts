import { Express, Request, Response } from "express";
import { PluginConfig } from "./types";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * App Config API plugin
 * Serves app.config.json from static directory if it exists,
 * otherwise provides a default demo configuration
 */
export default function (app: Express, config: PluginConfig) {
  app.get("/app.config.json", (req: Request, res: Response) => {
    const configPath = join(config.staticPath, "app.config.json");

    // Check if the config file exists in static assets
    if (existsSync(configPath)) {
      try {
        const fileContent = readFileSync(configPath, "utf-8");
        const configData = JSON.parse(fileContent);
        res.json(configData);
        return;
      } catch (error) {
        console.error("Error reading app.config.json:", error);
        res.status(500).json({
          error: "Failed to read configuration file",
        });
        return;
      }
    }

    // Fallback to demo configuration
    res.json({
      name: "App Config",
      version: "1.0.0",
      description: "App Config Description (Demo)",
      staticPath: config.staticPath,
      staticDir: config.staticDir,
      port: config.port,
      apiUrl: "https://api.example.com",
      features: {
        darkMode: true,
        notifications: true,
      },
    });
  });

  console.log("    - Registered: GET /app.config.json");
}
