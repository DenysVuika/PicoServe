import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { loadApiPlugins } from './api/loader';

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Enable CORS with unrestricted access for development
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Get static files directory from command line args or environment variable, default to 'public'
const staticDir = process.argv[2] || process.env.STATIC_DIR || 'public';
const staticPath = path.isAbsolute(staticDir) 
  ? staticDir 
  : path.join(__dirname, '..', staticDir);

// Serve static files from the specified directory
app.use(express.static(staticPath));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Load API plugins
const apiDir = path.join(__dirname, 'api');
loadApiPlugins(app, apiDir).then(() => {
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
