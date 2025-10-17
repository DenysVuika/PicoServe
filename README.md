# PicoServe

A lightweight TypeScript-based Node.js and Express.js server for serving static files.

## Features

- 🚀 Built with TypeScript for type safety
- 📁 Serves static files from the `public` directory
- ⚡ Express.js-powered web server
- 🔧 Simple configuration

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

The server will start on `http://localhost:3000` by default. You can configure the port by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Project Structure

```
PicoServe/
├── src/
│   └── server.ts       # Main server file
├── public/             # Static files directory
│   └── index.html      # Sample HTML file
├── dist/               # Compiled JavaScript (generated)
├── tsconfig.json       # TypeScript configuration
└── package.json        # Project dependencies
```

## Endpoints

- `GET /` - Serves static files from the `public` directory
- `GET /health` - Health check endpoint

## Adding Static Files

Simply place your static files (HTML, CSS, JavaScript, images, etc.) in the `public` directory, and they will be served automatically.

## License

ISC
