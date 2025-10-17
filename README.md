# PicoServe

A lightweight TypeScript-based Node.js and Express.js server for serving static files.

## Features

- 🚀 Built with TypeScript for type safety
- 📁 Serves static files from a configurable directory (defaults to `public`)
- ⚡ Express.js-powered web server
- 🔧 Simple configuration with environment variables and command-line arguments
- 🌐 CORS enabled for development (unrestricted access)
- 🎯 SPA (Single Page Application) support with client-side routing fallback
- 🔌 Plugin system for custom API endpoints
- 🔀 Configurable proxy support for backend APIs and authentication services

## Installation

```bash
npm install
```

## Usage

### Development Mode

Run the server in development mode with TypeScript directly:

```bash
npm run dev
```

### Production Mode

1. Build the TypeScript code:

```bash
npm run build
```

2. Start the server:

```bash
npm start
```

The server will start on `http://localhost:3000` by default.

### Configuration

You can configure the server using environment variables:

**Port Configuration:**

```bash
PORT=8080 npm start
```

**Static Files Directory:**

You can specify a custom directory for static files in three ways:

1. **Command-line argument (recommended for production):**

```bash
# Relative path
node dist/server.js assets

# Absolute path
node dist/server.js /path/to/static/files
```

2. **Environment variable:**

```bash
STATIC_DIR=assets npm start
```

3. **Default:** If not specified, the server uses the `public` directory

### CORS Configuration

The server comes with CORS (Cross-Origin Resource Sharing) enabled by default with credentials support. This is ideal for development environments where you might be running your frontend and backend on different ports, and when using authentication tokens or cookies.

**Current Setup (Development):**
- Reflects the request origin (allows any origin dynamically)
- **Credentials enabled** - supports cookies, authorization headers, and TLS client certificates
- Allows common HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS)
- Allows standard headers (Content-Type, Authorization, X-Requested-With)
- Caches preflight OPTIONS requests for 10 minutes

**Why Credentials are Important:**
- Required when using cookies for authentication
- Needed for Authorization headers to work properly with proxies
- Essential for OIDC/OAuth flows
- Allows CORS preflight (OPTIONS) requests to pass through

**For Production:**

If you need to restrict CORS to specific origins in production, you can modify the `cors()` configuration in `src/server.ts`:

```typescript
// Restrict to specific origin
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

// Or allow multiple specific origins
app.use(cors({
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

// For API-only servers (no credentials needed)
app.use(cors({
  origin: '*', // Only works when credentials: false
  credentials: false
}));
```

**Note:** When `credentials: true` is set, you cannot use `origin: '*'`. The server uses `origin: true` which reflects the requesting origin, providing the same flexibility while supporting credentials.

## Project Structure

```
PicoServe/
├── src/
│   ├── server.ts       # Main server file
│   └── api/            # API plugins directory
│       ├── loader.ts   # Plugin loader
│       ├── types.ts    # Plugin type definitions
│       ├── hello.ts    # Example plugin
│       ├── example.ts  # Example plugin with multiple endpoints
│       └── README.md   # API plugin documentation
├── public/             # Static files directory
│   └── index.html      # Sample HTML file
├── dist/               # Compiled JavaScript (generated)
├── tsconfig.json       # TypeScript configuration
└── package.json        # Project dependencies
```

## Endpoints

- `GET /` - Serves static files from the configured directory
- `GET /health` - Health check endpoint
- Custom API endpoints loaded from plugins (see below)

**Note:** Custom API endpoints registered via plugins have **higher precedence** than static files. This means if you create a plugin that serves `/app.config.json`, it will take priority over any static file with the same name in your public directory.

## API Plugins

PicoServe includes a plugin system that automatically loads custom API endpoints from the `src/api/` directory. This allows you to easily extend the server with your own backend logic without modifying the core server file.

### Quick Start

Create a new file in `src/api/` (e.g., `my-api.ts`):

```typescript
import { Express } from 'express';
import { PluginConfig } from './types';

export default function (app: Express, config: PluginConfig) {
  app.get('/api/my-endpoint', (req, res) => {
    res.json({
      message: 'Hello from my API!',
      staticPath: config.staticPath,
      port: config.port
    });
  });
}
```

The endpoint will be automatically discovered and registered on server startup!

### Plugin Configuration

All plugins receive a `config` object as the second parameter with access to server settings:

```typescript
interface PluginConfig {
  staticPath: string;  // Absolute path to static files directory
  staticDir: string;   // Original static directory argument
  port: number;        // Server port
  [key: string]: any;  // Custom config properties
}
```

This allows your plugins to:
- Access static files programmatically
- Read server configuration
- Share common settings across plugins

If your plugin doesn't need the config, prefix the parameter with `_`:

```typescript
export default function (app: Express, _config: PluginConfig) {
  // Plugin code that doesn't use config
}
```

### Example Plugins Included

- `/bff/hello` - Simple greeting endpoint
- `/api/example` - Example CRUD endpoints with parameters

### Production Notes

The plugin system works seamlessly in production:
- When you run `npm run build`, all TypeScript files (including plugins) are compiled to JavaScript in the `dist/` directory
- The loader automatically detects the environment and loads `.js` files in production, `.ts` files in development
- Simply deploy the `dist/` directory with your plugins included

For detailed documentation on creating plugins, see [src/api/README.md](src/api/README.md).

### Proxy Configuration

PicoServe includes built-in support for proxying requests to external services. This is particularly useful for:
- Proxying authentication requests to OIDC providers
- Forwarding API requests to backend services
- Avoiding CORS issues in development
- Routing requests to microservices

#### Quick Start

1. Create a `proxy.config.json` file in your static directory (e.g., `public/proxy.config.json`):

```json
{
  "proxies": [
    {
      "path": "/auth",
      "target": "https://your-oidc-provider.com",
      "options": {
        "changeOrigin": true
      }
    },
    {
      "path": "/api",
      "target": "https://your-backend.com",
      "options": {
        "changeOrigin": true
      }
    }
  ]
}
```

2. Use environment variables for flexible configuration:

```json
{
  "proxies": [
    {
      "path": "/api",
      "target": "${BACKEND_URL}",
      "options": {
        "changeOrigin": true
      }
    }
  ]
}
```

Set the environment variables in your `.env` file:

```env
BACKEND_URL=https://api.example.com
```

3. Start the server - proxies are automatically configured!

#### Example: Development Setup

For a typical development setup with a separate backend API:

**public/proxy.config.json:**
```json
{
  "proxies": [
    {
      "path": "/api",
      "target": "http://localhost:8080",
      "options": {
        "changeOrigin": true
      }
    }
  ]
}
```

Now all requests to `/api/*` will be proxied to your backend at `http://localhost:8080/api/*`.

For more advanced proxy configurations including path rewriting, multiple proxies, and detailed options, see [src/api/README.md](src/api/README.md#proxy-configuration-plugin).

## Adding Static Files

Simply place your static files (HTML, CSS, JavaScript, images, etc.) in your configured static directory (defaults to `public`), and they will be served automatically.

## License

ISC
