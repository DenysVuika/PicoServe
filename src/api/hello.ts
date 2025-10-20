import { Express, Request, Response } from 'express';
import { PluginConfig } from './types';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

/**
 * Hello API plugin
 * Provides a simple greeting endpoint with optional JWT authentication
 * 
 * Environment variables:
 * - OIDC_JWKS_URI: JWKS endpoint URL (e.g., https://your-oidc-provider.com/.well-known/jwks.json)
 * - OIDC_ISSUER: Token issuer URL (e.g., https://your-oidc-provider.com)
 * - OIDC_AUDIENCE: Expected audience/client ID
 */
export default function (app: Express, _config: PluginConfig) {
  // Initialize JWKS client if OIDC configuration is provided
  const jwksUri = process.env.OIDC_JWKS_URI;
  const issuer = process.env.OIDC_ISSUER;
  const audience = process.env.OIDC_AUDIENCE;

  let client: jwksClient.JwksClient | null = null;
  
  if (jwksUri) {
    client = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxAge: 86400000, // 24 hours in ms
    });
  }

  // Helper function to get signing key
  function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
    if (!client) {
      callback(new Error('JWKS client not initialized'), undefined);
      return;
    }
    
    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        callback(err, undefined);
        return;
      }
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  }

  // Basic hello endpoint (no auth required)
  app.get('/bff/hello', (req: Request, res: Response) => {
    res.json({ 
      message: 'Hello from BFF!',
      timestamp: new Date().toISOString()
    });
  });

  // User data endpoint with JWT authentication
  app.get('/bff/user-data', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    // If OIDC is not configured, just decode without verification (for demo purposes)
    if (!client || !issuer) {
      try {
        const decoded = jwt.decode(token) as any;
        if (!decoded) {
          return res.status(401).json({ error: 'Invalid token format' });
        }
        
        const username = decoded.username || decoded.email || decoded.preferred_username || decoded.sub || 'Unknown User';
        
        return res.json({ 
          message: `Hello, ${username}!`,
          data: `Custom data for ${username}`,
          timestamp: new Date().toISOString(),
          note: 'Token decoded without verification (OIDC not configured)'
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to decode token';
        return res.status(401).json({ error: errorMessage });
      }
    }

    // Verify JWT with JWKS if configured
    try {
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: ['RS256'],
        issuer,
      };
      
      if (audience) {
        verifyOptions.audience = audience;
      }

      const decoded = await new Promise<any>((resolve, reject) => {
        jwt.verify(token, getKey, verifyOptions, (err, decoded) => {
          if (err) reject(err);
          else resolve(decoded);
        });
      });

      const username = decoded.username || decoded.email || decoded.preferred_username || decoded.sub || 'Unknown User';
      
      res.json({ 
        message: `Hello, ${username}!`,
        data: `Custom data for ${username}`,
        timestamp: new Date().toISOString(),
        tokenInfo: {
          issuer: decoded.iss,
          subject: decoded.sub,
          expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined
        }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      return res.status(401).json({ error: 'Invalid token', details: errorMessage });
    }
  });

  console.log('    - Registered: GET /bff/hello');
  console.log('    - Registered: GET /bff/user-data (JWT auth)');
  
  if (!jwksUri) {
    console.log('    ⚠️  OIDC not configured - /bff/user-data will decode tokens without verification');
    console.log('    ℹ️  Set OIDC_JWKS_URI, OIDC_ISSUER, and OIDC_AUDIENCE env vars for full JWT verification');
  }
}

