#!/usr/bin/env node
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
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
// First try user's local directory, then fall back to bundled public folder
const userStaticPath = path.isAbsolute(staticDir) 
  ? staticDir 
  : path.join(process.cwd(), staticDir);

const bundledPublicPath = path.join(__dirname, '..', 'public');

let staticPath: string;

// Check if user's static directory exists
if (fs.existsSync(userStaticPath)) {
  staticPath = userStaticPath;
  console.log(`Using local static directory: ${staticDir}`);
} else if (fs.existsSync(bundledPublicPath)) {
  // Fall back to bundled public directory
  staticPath = bundledPublicPath;
  console.log(`⚠️  Local '${staticDir}' directory not found.`);
  console.log(`   Using bundled default files from package.`);
  console.log(`   💡 Tip: Create a '${staticDir}' directory in your current location to serve your own files.`);
} else {
  // Last resort: create an empty directory
  staticPath = userStaticPath;
  console.warn(`⚠️  Warning: Static directory '${staticDir}' does not exist.`);
  console.warn(`   Creating directory: ${staticPath}`);
  fs.mkdirSync(staticPath, { recursive: true });
  
  // Create a simple index.html file
  const indexPath = path.join(staticPath, 'index.html');
  const defaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PicoServe</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 { color: #333; }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .success { color: #28a745; }
  </style>
</head>
<body>
  <h1>🎉 PicoServe is running!</h1>
  <p class="success">Your server is up and running successfully.</p>
  <p>Add your static files (HTML, CSS, JS, images, etc.) to the <code>${staticDir}</code> directory to get started.</p>
  <h2>Quick Start:</h2>
  <ol>
    <li>Create your <code>index.html</code> file in the <code>${staticDir}</code> directory</li>
    <li>Add any other assets you need</li>
    <li>Refresh this page to see your content</li>
  </ol>
  <h2>Available Endpoints:</h2>
  <ul>
    <li><a href="/health">/health</a> - Health check endpoint</li>
  </ul>
</body>
</html>`;
  fs.writeFileSync(indexPath, defaultHtml);
  console.log(`   Created default index.html`);
}

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
    const indexPath = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        error: 'Not Found',
        message: `The requested resource was not found. Make sure your static files are in the '${staticDir}' directory.`,
        path: req.path
      });
    }
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
