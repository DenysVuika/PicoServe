import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { loadApiPlugins } from './api/loader';

const app: Express = express();
const PORT = parseInt(process.env.PORT || '4200', 10);

// Set up rate limiter: maximum of 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per windowMs
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

// Get static files directory from command line args or environment variable, default to 'public'
const staticDir = process.argv[2] || process.env.STATIC_DIR || 'public';
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
  port: PORT
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
