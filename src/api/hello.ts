import { Express, Request, Response } from 'express';
import { PluginConfig } from './types';

/**
 * Hello API plugin
 * Provides a simple greeting endpoint
 */
export default function (app: Express, _config: PluginConfig) {
  app.get('/bff/hello', (req: Request, res: Response) => {
    res.json({ 
      message: 'Hello from BFF!',
      timestamp: new Date().toISOString()
    });
  });

  console.log('    - Registered: GET /bff/hello');
}

