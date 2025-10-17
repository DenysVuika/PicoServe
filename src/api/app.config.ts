import { Express, Request, Response } from "express";

/**
 * App Config API plugin
 * Provides a dynamic app.config.json endpoint
 */
export default function (app: Express) {
  app.get("/app.config.json", (req: Request, res: Response) => {
    res.json({
      name: "App Config",
      version: "1.0.0",
      description: "App Config Description",
    });
  });

  console.log("    - Registered: GET /app.config.json");
}
