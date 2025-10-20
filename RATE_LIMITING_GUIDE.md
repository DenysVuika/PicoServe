# Rate Limiting Guide for PicoServe Proxy

## Understanding 429 Errors

When you see `[Proxy Response] GET /deployment-service/v1/feature-flags ← 429 Too Many Requests`, it means:

1. **Your proxy is working correctly** - requests are being forwarded
2. **The backend server is rate limiting** - you're making too many requests too quickly
3. **You need to slow down** - either at the client level or proxy level

## Solution 1: Proxy-Level Rate Limiting (IMPLEMENTED ✅)

I've added automatic rate limiting to your proxy configuration. This prevents your frontend from overwhelming the backend.

### How It Works

The proxy now supports a `rateLimit` option in your `proxy.config.json`:

```json
{
  "proxies": [
    {
      "path": "/deployment-service",
      "target": "${APP_CONFIG_BPM_HOST}",
      "options": {
        "changeOrigin": true,
        "secure": false,
        "ws": true,
        "rateLimit": {
          "windowMs": 60000,
          "max": 30
        }
      }
    }
  ]
}
```

### Configuration Options

- **`windowMs`**: Time window in milliseconds (default: 60000 = 1 minute)
- **`max`**: Maximum number of requests per window (default: 100)
- **`enabled`**: Set to `false` to disable rate limiting for a specific proxy

### Current Configuration

Your `.tmp/proxy.config.json` has been updated with:
- **30 requests per minute** for `/deployment-service`
- **30 requests per minute** for `/modeling-service`

### Adjusting the Limits

If you're still getting 429 errors:

1. **Reduce the limit further**:
   ```json
   "rateLimit": {
     "windowMs": 60000,
     "max": 20  // Lower to 20 requests/minute
   }
   ```

2. **Increase the time window**:
   ```json
   "rateLimit": {
     "windowMs": 120000,  // 2 minutes
     "max": 50
   }
   ```

3. **Disable rate limiting** (not recommended):
   ```json
   "rateLimit": {
     "enabled": false
   }
   ```

## Solution 2: Request Caching

Consider implementing caching to reduce duplicate requests:

### Frontend Caching

```typescript
// Cache feature flags for 5 minutes
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getFeatureFlags() {
  const cached = cache.get('feature-flags');
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch('/deployment-service/v1/feature-flags');
  const data = await response.json();

  cache.set('feature-flags', {
    data,
    timestamp: Date.now()
  });

  return data;
}
```

### HTTP Cache Headers

If the backend supports it, use cache headers:

```typescript
fetch('/deployment-service/v1/feature-flags', {
  headers: {
    'Cache-Control': 'max-age=300' // 5 minutes
  }
});
```

## Solution 3: Request Debouncing/Throttling

Prevent rapid-fire requests at the application level:

```typescript
import { debounce } from 'lodash';

// Only make request once every 2 seconds
const fetchFeatureFlags = debounce(async () => {
  return fetch('/deployment-service/v1/feature-flags');
}, 2000, { leading: true, trailing: false });
```

## Solution 4: Backend Configuration

If you control the backend, you can:

1. **Increase rate limits** for your IP/user
2. **Use API keys** with higher quotas
3. **Implement exponential backoff** in your requests

## Solution 5: Request Batching

If possible, batch multiple requests into one:

```typescript
// Instead of multiple requests
const flags1 = await fetch('/deployment-service/v1/feature-flags');
const flags2 = await fetch('/deployment-service/v1/other-flags');

// Use a batch endpoint if available
const allFlags = await fetch('/deployment-service/v1/batch', {
  method: 'POST',
  body: JSON.stringify({
    requests: ['feature-flags', 'other-flags']
  })
});
```

## Monitoring

After implementing rate limiting, you'll see logs like:

```
✓ /deployment-service → https://backend.example.com
ℹ Rate limit: 30 req/60s for /deployment-service
```

If a client exceeds the limit, they'll receive:

```json
{
  "error": "Too many requests",
  "message": "Please slow down. Maximum 30 requests per 60 seconds."
}
```

## Testing

1. **Restart your server** after updating the configuration:
   ```bash
   npm run build
   npm start
   ```

2. **Monitor the logs** to see if requests are being rate limited

3. **Adjust the limits** based on your actual usage patterns

## Best Practices

1. ✅ **Start conservative** - Begin with lower limits and increase as needed
2. ✅ **Cache responses** - Don't request the same data repeatedly
3. ✅ **Implement retry logic** - Use exponential backoff for failed requests
4. ✅ **Monitor usage** - Track how many requests you're making
5. ✅ **Respect backend limits** - Stay well below the backend's rate limits

## Troubleshooting

### Still getting 429 errors?

1. **Lower your proxy rate limits** to match backend limits
2. **Check if multiple clients** are using the same proxy
3. **Review your frontend code** for request loops
4. **Add caching** to reduce total request count

### Rate limiting too aggressive?

1. **Increase `max`** value
2. **Increase `windowMs`** for a longer time window
3. **Check logs** to see actual request patterns

## Need Help?

If you're still experiencing issues:

1. Check the console logs for rate limit messages
2. Monitor how many requests your app is making
3. Consider implementing frontend caching first
4. Contact the backend team about their rate limits

