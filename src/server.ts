import express, { Express, Request, Response } from 'express';
import path from 'path';

const app: Express = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Serving static files from: ${path.join(__dirname, '../public')}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port.`);
  } else {
    console.error('Failed to start server:', err);
  }
  process.exit(1);
});
