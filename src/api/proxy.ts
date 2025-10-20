import { Express } from "express";
import { PluginConfig, ProxyConfig } from "./types";
import { createProxyMiddleware } from "http-proxy-middleware";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import rateLimit from "express-rate-limit";

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
 * @param customConfigPath - Optional custom path to proxy config file
 * @returns Array of proxy configurations or null if file doesn't exist
 */
function loadProxyConfig(staticPath: string, customConfigPath?: string): ProxyConfig[] | null {
  // Use custom config path if provided, otherwise default to proxy.config.json in static directory
  const configPath = customConfigPath || join(staticPath, "proxy.config.json");

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
  const proxies = loadProxyConfig(config.staticPath, config.proxyConfigPath);

  if (!proxies || proxies.length === 0) {
    const configLocation = config.proxyConfigPath 
      ? config.proxyConfigPath 
      : `${config.staticPath}/proxy.config.json`;
    console.log(`    - No proxy configuration found (${configLocation})`);
    return;
  }

  const configSource = config.proxyConfigPath 
    ? `custom config: ${config.proxyConfigPath}` 
    : 'proxy.config.json';
  console.log(`    - Setting up proxies (${configSource}):`);

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
      // Add rate limiting to prevent overwhelming the backend
      // You can customize these values in your proxy.config.json
      const rateLimitConfig = (proxy.options as any)?.rateLimit || {
        windowMs: 60 * 1000, // 1 minute
        max: 100, // limit each IP to 100 requests per windowMs
      };

      if (rateLimitConfig.enabled !== false) {
        const limiter = rateLimit({
          windowMs: rateLimitConfig.windowMs || 60 * 1000,
          max: rateLimitConfig.max || 100,
          message: {
            error: "Too many requests",
            message: `Please slow down. Maximum ${rateLimitConfig.max || 100} requests per ${(rateLimitConfig.windowMs || 60000) / 1000} seconds.`,
          },
          standardHeaders: true,
          legacyHeaders: false,
        });
        
        app.use(proxy.path, limiter);
        console.log(`      ℹ Rate limit: ${rateLimitConfig.max || 100} req/${(rateLimitConfig.windowMs || 60000) / 1000}s for ${proxy.path}`);
      }
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

