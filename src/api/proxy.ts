import { Express } from "express";
import { PluginConfig, ProxyConfig } from "./types";
import { createProxyMiddleware } from "http-proxy-middleware";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Substitutes environment variables in a string
 * Replaces ${VAR_NAME} with process.env.VAR_NAME
 * @param content - The string content to process
 * @returns The content with substituted environment variables
 */
function substituteEnvVariables(content: string): string {
  return content.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      console.warn(
        `Environment variable ${varName} is not defined, keeping placeholder`
      );
      return match;
    }
    return envValue;
  });
}

/**
 * Loads proxy configuration from proxy.config.json file
 * @param staticPath - Path to the static directory
 * @returns Array of proxy configurations or null if file doesn't exist
 */
function loadProxyConfig(staticPath: string): ProxyConfig[] | null {
  const configPath = join(staticPath, "proxy.config.json");

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const fileContent = readFileSync(configPath, "utf-8");
    // Substitute environment variables before parsing JSON
    const substitutedContent = substituteEnvVariables(fileContent);
    const config = JSON.parse(substitutedContent);

    if (!Array.isArray(config.proxies)) {
      console.error(
        "Invalid proxy.config.json: 'proxies' must be an array"
      );
      return null;
    }

    return config.proxies;
  } catch (error) {
    console.error("Error reading proxy.config.json:", error);
    return null;
  }
}

/**
 * Proxy Configuration API plugin
 * Sets up proxy middleware based on proxy.config.json configuration
 *
 * Example proxy.config.json:
 * {
 *   "proxies": [
 *     {
 *       "path": "/auth",
 *       "target": "https://your-oidc-provider.com",
 *       "options": {
 *         "changeOrigin": true
 *       }
 *     },
 *     {
 *       "path": "/api",
 *       "target": "${BACKEND_URL}",
 *       "options": {
 *         "changeOrigin": true,
 *         "pathRewrite": {
 *           "^/api": ""
 *         }
 *       }
 *     }
 *   ]
 * }
 */
export default function (app: Express, config: PluginConfig) {
  const proxies = loadProxyConfig(config.staticPath);

  if (!proxies || proxies.length === 0) {
    console.log("    - No proxy configuration found (proxy.config.json)");
    return;
  }

  console.log("    - Setting up proxies:");

  for (const proxy of proxies) {
    if (!proxy.path || !proxy.target) {
      console.warn(
        "    ⚠ Skipping invalid proxy config: missing path or target"
      );
      continue;
    }

    try {
      const proxyOptions = {
        target: proxy.target,
        changeOrigin: true, // Default to true for most use cases
        ...proxy.options,
      };

      app.use(proxy.path, createProxyMiddleware(proxyOptions));
      console.log(`      ✓ ${proxy.path} → ${proxy.target}`);
    } catch (error) {
      console.error(`      ✗ Failed to set up proxy for ${proxy.path}:`, error);
    }
  }
}

