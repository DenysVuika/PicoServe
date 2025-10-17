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

    // Check if target still has unresolved env variables
    if (proxy.target.includes("${")) {
      console.error(
        `    ✗ Skipping proxy ${proxy.path}: unresolved environment variable in target: ${proxy.target}`
      );
      continue;
    }

    try {
      // Store custom callbacks from user config if they exist
      const customOptions = proxy.options as any;
      const customOnProxyReq = customOptions?.onProxyReq;
      const customOnProxyRes = customOptions?.onProxyRes;
      const customOnError = customOptions?.onError;

      const proxyOptions = {
        target: proxy.target,
        changeOrigin: true, // Default to true for most use cases
        ...proxy.options,
        // Override with logging callbacks that also call custom ones
        on: {
          proxyReq: (proxyReq: any, req: any, res: any) => {
            const targetUrl = `${proxy.target}${proxyReq.path}`;
            const originalUrl = req.originalUrl || req.url;
            
            // Log request
            console.log(`[Proxy Request] ${req.method} ${originalUrl} → ${targetUrl}`);
            
            // Log auth-related headers if present
            if (req.headers.authorization) {
              console.log(`[Proxy Request] Authorization: ${req.headers.authorization.substring(0, 20)}...`);
            }
            if (req.headers.cookie) {
              console.log(`[Proxy Request] Cookie: ${req.headers.cookie.substring(0, 50)}...`);
            }
            
            // Forward auth headers or cookies
            if (req.headers.cookie) {
              proxyReq.setHeader("cookie", req.headers.cookie);
            }
            if (req.headers.authorization) {
              proxyReq.setHeader("authorization", req.headers.authorization);
            }
            
            // Call custom callback if provided
            if (customOnProxyReq) {
              customOnProxyReq(proxyReq, req, res);
            }
          },
          proxyRes: (proxyRes: any, req: any, res: any) => {
            const originalUrl = req.originalUrl || req.url;
            console.log(`[Proxy Response] ${req.method} ${originalUrl} ← ${proxyRes.statusCode} ${proxyRes.statusMessage || ''}`);
            
            // Call custom callback if provided
            if (customOnProxyRes) {
              customOnProxyRes(proxyRes, req, res);
            }
          },
          error: (err: any, req: any, res: any) => {
            const originalUrl = req.originalUrl || req.url;
            console.error(`[Proxy Error] ${req.method} ${originalUrl}:`, err.message);
            console.error(`[Proxy Error] Target: ${proxy.target}`);
            console.error(`[Proxy Error] Code: ${err.code}`);
            
            // Call custom callback if provided, otherwise send default error response
            if (customOnError) {
              customOnError(err, req, res);
            } else if (!res.headersSent) {
              res.status(502).json({
                error: "Proxy Error",
                message: `Failed to connect to ${proxy.target}`,
                details: err.message,
                code: err.code,
                path: req.url
              });
            }
          },
        },
      };

      // Use filter function to match the path
      const filterOptions = {
        ...proxyOptions,
        pathFilter: (pathname: string) => {
          return pathname.startsWith(proxy.path);
        }
      };
      
      const middleware = createProxyMiddleware(filterOptions);
      app.use(middleware);
      
      console.log(`      ✓ ${proxy.path} → ${proxy.target}`);
    } catch (error) {
      console.error(`      ✗ Failed to set up proxy for ${proxy.path}:`, error);
    }
  }
}

