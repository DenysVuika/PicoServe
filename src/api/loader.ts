import { Express } from 'express';
import { readdirSync } from 'fs';
import { join } from 'path';
import { ApiPlugin, PluginMetadata, PluginConfig } from './types';

/**
 * Loads all API plugins from the api directory
 * Each plugin file should export a default function that registers routes
 */
export async function loadApiPlugins(app: Express, apiDir: string, config: PluginConfig): Promise<void> {
  console.log('Loading API plugins...');
  
  try {
    const files = readdirSync(apiDir);
    const plugins: PluginMetadata[] = [];

    // In production (compiled), only .js files exist
    // In development (ts-node), only .ts files exist
    const isProduction = files.some(f => f.endsWith('.js'));

    for (const file of files) {
      // Skip non-JS/TS files and type definition files
      if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;
      if (file.endsWith('.d.ts')) continue;
      
      // Skip .ts files in production and .js files in development
      if (isProduction && file.endsWith('.ts')) continue;
      if (!isProduction && file.endsWith('.js')) continue;
      
      // Skip the loader and types files
      if (file === 'loader.ts' || file === 'loader.js' || 
          file === 'types.ts' || file === 'types.js' ||
          file === 'types.d.ts') continue;

      const pluginPath = join(apiDir, file);
      
      try {
        // Dynamic import of the plugin
        const pluginModule = await import(pluginPath);
        const plugin: ApiPlugin = pluginModule.default;

        if (typeof plugin !== 'function') {
          console.warn(`Plugin ${file} does not export a default function, skipping...`);
          continue;
        }

        // Register the plugin with config
        await plugin(app, config);
        
        plugins.push({
          name: file.replace(/\.(js|ts)$/, ''),
          path: pluginPath
        });

        console.log(`  ✓ Loaded plugin: ${file}`);
      } catch (error) {
        console.error(`  ✗ Failed to load plugin ${file}:`, error);
      }
    }

    console.log(`Successfully loaded ${plugins.length} API plugin(s)`);
  } catch (error) {
    console.error('Error loading API plugins:', error);
  }
}

