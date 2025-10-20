#!/usr/bin/env node
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { loadApiPlugins } from './api/loader';
import { parseArgs } from 'node:util';

/**
 * Parse command line arguments
 * Supports:
 * -s, --static <dir>   : Static files directory (default: 'public')
 * -p, --proxy <path>   : Path to proxy configuration file
 * -h, --help           : Show help message
 */
function parseCommandLineArgs() {
  try {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        static: {
          type: 'string',
          short: 's',
        },
        proxy: {
          type: 'string',
          short: 'p',
        },
        help: {
          type: 'boolean',
          short: 'h',
        },
      },
      strict: true,
    });

    if (values.help) {
      console.log(`
PicoServe - Simple HTTP server with API plugin support

Usage: node dist/server.js [options]

Options:
  -s, --static <dir>    Static files directory (default: 'public')
  -p, --proxy <path>    Path to proxy configuration JSON file
  -h, --help            Show this help message

Environment Variables:
  PORT                  Server port (default: 4200)
  STATIC_DIR            Static files directory (overridden by -s)

Examples:
  node dist/server.js -s ./build
  node dist/server.js -s ./public -p ./proxy.config.json
  PORT=3000 node dist/server.js -s ./dist
`);
      process.exit(0);
    }

    return {
      staticDir: values.static || process.env.STATIC_DIR || 'public',
      proxyConfigPath: values.proxy || undefined,
    };
  } catch (error: any) {
    console.error('Error parsing command line arguments:', error.message);
    console.error('Use --help or -h to see available options');
    process.exit(1);
  }
}

const { staticDir, proxyConfigPath } = parseCommandLineArgs();

const app: Express = express();
const PORT = parseInt(process.env.PORT || '4200', 10);

// Set up global rate limiter for general server protection
// This is a higher limit to catch abuse while allowing normal usage
// Individual proxy paths have their own more specific rate limits
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // max 1000 requests per windowMs (raised from 100)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiter to all requests
app.use(limiter);

// Enable CORS with credentials support for development
app.use(cors({
  origin: true, // Reflects the request origin (allows any origin in dev)
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // Cache preflight requests for 10 minutes
}));

// Parse JSON bodies
app.use(express.json());

// Get static files directory from command line args
const staticPath = path.isAbsolute(staticDir) 
  ? staticDir 
  : path.join(__dirname, '..', staticDir);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Load API plugins BEFORE static files
// This ensures custom routes take precedence over static files
const apiDir = path.join(__dirname, 'api');
const pluginConfig = {
  staticPath,
  staticDir,
  port: PORT,
  proxyConfigPath
};
loadApiPlugins(app, apiDir, pluginConfig).then(() => {
  // Serve static files from the specified directory
  // Registered AFTER API plugins so custom routes have priority
  app.use(express.static(staticPath));

  // SPA fallback - serve index.html for all other routes
  // This allows client-side routing to work properly
  app.use((req: Request, res: Response) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Serving static files from: ${staticDir}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port.`);
  } else {
    console.error('Failed to start server:', err);
  }
  process.exit(1);
});
