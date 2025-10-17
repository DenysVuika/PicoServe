import { Express } from 'express';

/**
 * API Plugin interface
 * Each plugin must export a default function that registers routes
 */
export interface ApiPlugin {
  (app: Express): void | Promise<void>;
}

export interface PluginMetadata {
  name: string;
  path: string;
}

