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
- 🔐 JWT authentication example with JWKS verification support

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

The server will start on `http://localhost:4200` by default.

### Configuration

You can configure the server using command-line parameters and environment variables.

#### Command Line Parameters

```bash
node dist/server.js [options]

Options:
  -s, --static <dir>    Static files directory (default: 'public')
  -p, --proxy <path>    Path to proxy configuration JSON file
  -h, --help            Show help message
```

**Examples:**

```bash
# Serve from a different directory
node dist/server.js -s ./build

# Use custom proxy config
node dist/server.js -p /path/to/proxy.config.json

# Combine both options
node dist/server.js -s ./dist -p ./config/proxy.json

# With custom port
PORT=3000 node dist/server.js -s ./public
```

#### Environment Variables

**Port Configuration:**

```bash
PORT=8080 npm start
```

**Static Files Directory:**

```bash
STATIC_DIR=assets npm start
```

Note: Command-line parameters take precedence over environment variables.

**Priority Order:**

1. Command-line parameter (`-s` or `--static`)
2. Environment variable (`STATIC_DIR`)
3. Default: `public` directory

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

```text
PicoServe/
├── src/
│   ├── server.ts        # Main server file
│   └── api/             # API plugins directory
│       ├── loader.ts    # Plugin loader
│       ├── types.ts     # Plugin type definitions
│       ├── proxy.ts     # Proxy configuration plugin
│       ├── app.config.ts # App configuration plugin
│       ├── hello.ts     # Example plugin
│       ├── example.ts   # Example plugin with multiple endpoints
│       └── README.md    # API plugin documentation
├── public/              # Static files directory
│   ├── index.html       # Sample HTML file
│   ├── jwt-test.html    # JWT authentication test UI
│   └── proxy.config.json # Proxy configuration (optional)
├── dist/                # Compiled JavaScript (generated)
├── tsconfig.json        # TypeScript configuration
└── package.json         # Project dependencies
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

- **`/bff/hello`** - Simple greeting endpoint (public, no auth)
- **`/bff/user-data`** - JWT authentication example with JWKS support
  - Demonstrates how to decode and verify JWT tokens
  - Extracts username from token claims
  - Works in dev mode (decode only) or production mode (full verification with OIDC)
  - Includes interactive test page at `/jwt-test.html`
  - See [JWT Authentication Guide](src/api/README.md#hello-api-plugin-with-jwt-authentication) for details
- **`/api/example`** - Example CRUD endpoints with parameters

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

1. Create a `proxy.config.json` file. You can either:
   - Place it in your static directory (e.g., `public/proxy.config.json`) - detected automatically
   - Place it anywhere and specify the path with `-p` parameter (e.g., `node dist/server.js -p ./config/proxy.json`)

**Example `proxy.config.json`:**

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

2. Start the server - proxies are automatically configured and all proxy activity is logged!

3. Use environment variables for flexible configuration:

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

4. Start the server - proxies are automatically configured!

#### Proxy Logging

All proxy requests and responses are automatically logged to the console:

```
[Proxy Request] GET /api/users → https://backend.example.com/api/users
[Proxy Request] Authorization: Bearer eyJhbGciOiJIUzI...
[Proxy Response] GET /api/users ← 200 OK
```

This helps you:

- Debug proxy configuration issues
- Monitor API calls to backend services
- Track authentication headers being forwarded
- Identify failed requests and error codes

Error logging includes detailed information:
```
[Proxy Error] GET /api/users: ECONNREFUSED
[Proxy Error] Target: https://backend.example.com
[Proxy Error] Code: ECONNREFUSED
```

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

#### Rate Limiting

PicoServe includes built-in rate limiting to prevent overwhelming backend services. Configure per-proxy limits:

```json
{
  "proxies": [
    {
      "path": "/api",
      "target": "https://your-backend.com",
      "options": {
        "changeOrigin": true,
        "rateLimit": {
          "windowMs": 60000,
          "max": 100
        }
      }
    }
  ]
}
```

**Options:**
- `windowMs`: Time window in milliseconds (default: 60000 = 1 minute)
- `max`: Maximum requests per window (default: 100)
- `enabled`: Set to `false` to disable for a specific proxy

**When you exceed the limit:**
```json
{
  "error": "Too many requests",
  "message": "Please slow down. Maximum 100 requests per 60 seconds."
}
```

This helps you:
- Avoid 429 (Too Many Requests) errors from backends
- Control API usage costs
- Prevent accidental request loops
- Protect backend services from overload

**Learn More:**
- [RATE_LIMITING_GUIDE.md](RATE_LIMITING_GUIDE.md) - Complete guide on handling rate limiting
- [RATE_LIMITING_ARCHITECTURE.md](RATE_LIMITING_ARCHITECTURE.md) - How the two-tier rate limiting system works

For more advanced proxy configurations including path rewriting, multiple proxies, and detailed options, see [src/api/README.md](src/api/README.md#proxy-configuration-plugin).

## Adding Static Files

Simply place your static files (HTML, CSS, JavaScript, images, etc.) in your configured static directory (defaults to `public`), and they will be served automatically.

## License

ISC
