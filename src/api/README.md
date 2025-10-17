# API Plugins

This directory contains API endpoint plugins that are automatically loaded on server startup.

## How It Works

The plugin loader (`loader.ts`) automatically discovers and registers all API plugins in this directory. Each plugin file should export a default function that receives the Express app instance and a configuration object, then registers routes.

**Important:** Plugins are loaded **before** static file middleware, which means your custom API endpoints have **higher precedence** than static files with the same path.

## Creating a New Plugin

1. Create a new TypeScript file in this directory (e.g., `my-plugin.ts`)
2. Export a default function that takes an Express app and config as parameters
3. Register your routes inside the function

### Example Plugin

```typescript
import { Express, Request, Response } from 'express';
import { PluginConfig } from './types';

export default function (app: Express, config: PluginConfig) {
  // Register GET endpoint
  app.get('/api/my-endpoint', (req: Request, res: Response) => {
    res.json({
      message: 'Hello from my plugin!',
      serverPort: config.port,
      staticPath: config.staticPath
    });
  });

  // Register POST endpoint
  app.post('/api/my-endpoint', (req: Request, res: Response) => {
    const data = req.body;
    res.json({ success: true, received: data });
  });

  // Log registered routes (optional but helpful)
  console.log('    - Registered: GET /api/my-endpoint');
  console.log('    - Registered: POST /api/my-endpoint');
}
```

### Plugin Configuration

All plugins receive a `config` object with server settings:

```typescript
interface PluginConfig {
  staticPath: string;  // Absolute path to static files directory
  staticDir: string;   // Original static directory argument
  port: number;        // Server port
  [key: string]: any;  // Custom config properties
}
```

Use the config to:
- Access the static files directory programmatically
- Read server configuration values
- Access custom configuration properties you add

If your plugin doesn't need the config parameter, prefix it with `_`:

```typescript
export default function (app: Express, _config: PluginConfig) {
  // Your plugin code
}
```

## Plugin Features

- **Automatic Discovery**: All `.ts` and `.js` files in this directory are automatically loaded
- **Async Support**: Plugins can be async functions if needed
- **Multiple Routes**: Each plugin can register multiple endpoints
- **Full Express API**: Plugins have access to the full Express API (middleware, routers, etc.)
- **Error Handling**: If a plugin fails to load, the server continues with other plugins

## Examples

### Simple GET Endpoint

```typescript
import { Express } from 'express';
import { PluginConfig } from './types';

export default function (app: Express, _config: PluginConfig) {
  app.get('/api/users', (req, res) => {
    res.json([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]);
  });
}
```

### Using Express Router

```typescript
import { Express, Router } from 'express';
import { PluginConfig } from './types';

export default function (app: Express, _config: PluginConfig) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ message: 'Product list' });
  });

  router.get('/:id', (req, res) => {
    res.json({ id: req.params.id, name: 'Product' });
  });

  app.use('/api/products', router);
}
```

### Async Plugin

```typescript
import { Express } from 'express';
import { PluginConfig } from './types';

export default async function (app: Express, _config: PluginConfig) {
  // Perform async initialization
  await someAsyncSetup();

  app.get('/api/data', async (req, res) => {
    const data = await fetchData();
    res.json(data);
  });
}
```

### Accessing Static Files from Plugin

```typescript
import { Express } from 'express';
import { PluginConfig } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

export default function (app: Express, config: PluginConfig) {
  app.get('/api/config', (req, res) => {
    try {
      // Read a file from the static directory
      const configPath = join(config.staticPath, 'app-config.json');
      const fileContent = readFileSync(configPath, 'utf-8');
      const data = JSON.parse(fileContent);

      res.json({
        ...data,
        serverInfo: {
          port: config.port,
          staticDir: config.staticDir
        }
      });
    } catch (error) {
      res.status(404).json({ error: 'Config file not found' });
    }
  });
}
```

### Overriding Static Files

Since plugins load before static files, you can override specific static file paths:

```typescript
import { Express } from 'express';
import { PluginConfig } from './types';

export default function (app: Express, _config: PluginConfig) {
  // This will take precedence over /app.config.json in the static directory
  app.get('/app.config.json', (req, res) => {
    res.json({
      name: 'Dynamic Config',
      version: '2.0.0',
      timestamp: new Date().toISOString()
    });
  });
}
```

## Production Deployment

The plugin system works seamlessly in both development and production:

### Development (with ts-node)

```bash
npm run dev
```

- Loads `.ts` files directly from `src/api/`
- Hot reload with `--watch` flag

### Production (compiled)

```bash
npm run build
npm start
```

- TypeScript compiles all files to `dist/api/` as `.js` files
- The loader automatically detects the environment and loads `.js` files in production
- The entire `dist/` directory structure mirrors `src/`, so plugins work identically

### What Gets Deployed

After running `npm run build`, your production structure will be:

```text
dist/
├── server.js
└── api/
    ├── loader.js
    ├── types.js
    ├── hello.js
    ├── example.js
    └── (any custom plugins you added)
```

Just deploy the `dist/` directory along with `node_modules/` and `package.json`.

## Notes

- Plugins are loaded in alphabetical order by filename
- The `loader.ts` and `types.ts` files are automatically skipped
- The loader automatically detects whether to load `.ts` (dev) or `.js` (production) files
- Make sure to handle errors within your endpoints
- Use appropriate HTTP methods (GET, POST, PUT, DELETE, etc.)
- Consider adding request validation for production use
