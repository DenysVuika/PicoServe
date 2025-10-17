import { Express, Request, Response } from 'express';

/**
 * Example API plugin
 * Demonstrates how to create multiple endpoints in a single plugin
 */
export default function (app: Express) {
  // Example GET endpoint
  app.get('/api/example', (req: Request, res: Response) => {
    res.json({ 
      example: true,
      message: 'This is an example endpoint'
    });
  });

  // Example endpoint with URL parameters
  app.get('/api/example/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    res.json({ 
      id,
      message: `Example item with ID: ${id}`
    });
  });

  // Example POST endpoint (requires body parser middleware)
  app.post('/api/example', (req: Request, res: Response) => {
    res.json({ 
      success: true,
      received: req.body,
      message: 'Data received successfully'
    });
  });

  console.log('    - Registered: GET /api/example');
  console.log('    - Registered: GET /api/example/:id');
  console.log('    - Registered: POST /api/example');
}

