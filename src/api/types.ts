import { Express } from 'express';

/**
 * Configuration object passed to all plugins
 */
export interface PluginConfig {
  staticPath: string;
  staticDir: string;
  port: number;
  [key: string]: any; // Allow additional custom config
}

/**
 * API Plugin interface
 * Each plugin must export a default function that registers routes
 */
export interface ApiPlugin {
  (app: Express, config: PluginConfig): void | Promise<void>;
}

export interface PluginMetadata {
  name: string;
  path: string;
}

