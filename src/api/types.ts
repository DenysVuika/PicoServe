import { Express } from 'express';
import { Options as ProxyOptions } from 'http-proxy-middleware';

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

/**
 * Proxy configuration interface
 * Defines how to proxy requests from a path to a target URL
 */
export interface ProxyConfig {
  /** The path to intercept (e.g., '/api', '/auth') */
  path: string;
  /** The target URL to proxy to (e.g., 'https://api.example.com') */
  target: string;
  /** Proxy middleware options */
  options?: Omit<ProxyOptions, 'target'>;
}

