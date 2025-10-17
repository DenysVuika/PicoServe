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

The server comes with CORS (Cross-Origin Resource Sharing) enabled by default, allowing unrestricted access from any origin. This is ideal for development environments where you might be running your frontend and backend on different ports.

**Current Setup (Development):**
- Allows all origins (`Access-Control-Allow-Origin: *`)
- Allows all HTTP methods (GET, POST, PUT, DELETE, etc.)
- Allows all headers

**For Production:**

If you need to restrict CORS to specific origins in production, you can modify the `cors()` configuration in `src/server.ts`:

```typescript
// Restrict to specific origin
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));

// Or allow multiple specific origins
app.use(cors({
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
  credentials: true
}));
```

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

## API Plugins

PicoServe includes a plugin system that automatically loads custom API endpoints from the `src/api/` directory. This allows you to easily extend the server with your own backend logic without modifying the core server file.

### Quick Start

Create a new file in `src/api/` (e.g., `my-api.ts`):

```typescript
import { Express } from 'express';

export default function (app: Express) {
  app.get('/api/my-endpoint', (req, res) => {
    res.json({ message: 'Hello from my API!' });
  });
}
```

The endpoint will be automatically discovered and registered on server startup!

### Example Plugins Included

- `/bff/hello` - Simple greeting endpoint
- `/api/example` - Example CRUD endpoints with parameters

For detailed documentation on creating plugins, see [src/api/README.md](src/api/README.md).

## Adding Static Files

Simply place your static files (HTML, CSS, JavaScript, images, etc.) in your configured static directory (defaults to `public`), and they will be served automatically.

## License

ISC
