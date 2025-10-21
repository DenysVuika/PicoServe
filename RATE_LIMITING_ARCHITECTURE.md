# Rate Limiting Architecture

## Two-Tier Rate Limiting System

PicoServe uses a two-tier rate limiting approach to protect both your server and backend services.

```
┌─────────────────────────────────────────────────────────────┐
│                    Incoming Request                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │   TIER 1: Global Limiter      │
        │   (server.ts line 79-88)      │
        │                               │
        │   1000 requests / 15 minutes  │
        │   Protects: Entire server     │
        │   Applies to: ALL endpoints   │
        └───────────┬───────────────────┘
                    │
                    ├─── /health ✓
                    ├─── /static/file.js ✓
                    ├─── /api/example ✓
                    │
                    └─── /deployment-service/...
                         │
                         ▼
        ┌───────────────────────────────────┐
        │   TIER 2: Proxy-Specific Limiter  │
        │   (proxy.ts line 129-141)         │
        │                                   │
        │   30 requests / 1 minute          │
        │   Protects: Backend service       │
        │   Applies to: /deployment-service │
        └───────────┬───────────────────────┘
                    │
                    ▼
        ┌───────────────────────────────┐
        │   Backend Service             │
        │   ${APP_CONFIG_BPM_HOST}      │
        └───────────────────────────────┘
```

## How It Works

### Request Flow

1. **Every request** hits the **Global Limiter** first
   - Tracks all requests from an IP address
   - Broad protection against abuse
   - Higher limit (1000/15min)

2. **Proxy requests** also hit their **Proxy-Specific Limiter**
   - Only applies to that specific proxy path
   - Tighter control per backend service
   - Lower limit (30/1min for your config)

### Both Limiters Must Pass

```typescript
if (globalLimitExceeded) {
  return 429; // "Too many requests from this IP..."
}

if (proxyLimitExceeded) {
  return 429; // "Please slow down. Maximum 30 requests per 60 seconds."
}

// Forward to backend
proxyToBackend();
```

## Configuration

### Global Limiter (All Endpoints)

**File:** `src/server.ts`

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000,                  // 1000 requests total
});
app.use(limiter);  // Applied globally
```

**Adjust by editing:** Lines 79-88 in `src/server.ts`

### Proxy-Specific Limiters (Per Proxy)

**File:** `public/proxy.config.json` (or your proxy config)

```json
{
  "path": "/deployment-service",
  "target": "${APP_CONFIG_BPM_HOST}",
  "options": {
    "rateLimit": {
      "windowMs": 60000,  // 1 minute
      "max": 30           // 30 requests
    }
  }
}
```

**Adjust by editing:** Your `proxy.config.json` file

## Limits Comparison

| Limiter | Window | Max | Requests/Min | Purpose |
|---------|--------|-----|--------------|---------|
| **Global** | 15 min | 1000 | ~67/min | Server protection |
| **Proxy** | 1 min | 30 | 30/min | Backend protection |

The proxy limiter is **more restrictive** for proxy endpoints, which is correct!

## Why Two Limiters?

### Global Limiter (server.ts)

- ✅ Protects your server infrastructure
- ✅ Catches attackers trying to overwhelm any endpoint
- ✅ Prevents abuse of static files, health checks, etc.
- ✅ Higher limit allows normal usage

### Proxy Limiter (proxy.ts)

- ✅ Protects backend services from overload
- ✅ Respects backend's rate limits
- ✅ Configurable per backend service
- ✅ Prevents 429 errors from backends
- ✅ Lower limit prevents overwhelming specific services

## Real-World Example

**User making 100 requests in 1 minute:**

### To `/health` endpoint

```text
✓ Global: 100/1000 requests (passes)
→ Success! No proxy limiter applies
```

### To `/deployment-service`

```text
✗ Proxy: 31/30 requests (FAILS after 30 requests)
→ 429 Error: "Please slow down. Maximum 30 requests per 60 seconds"
```

### To mixed endpoints (50 to `/health`, 25 to each proxy)

```text
✓ Global: 100/1000 requests (passes)
✓ Proxy 1: 25/30 requests (passes)
✓ Proxy 2: 25/30 requests (passes)
→ All succeed!
```

## Adjusting Limits

### If You're Still Getting 429 Errors

1. **Check which limiter is triggering:**
   - Look at the error message
   - "Too many requests from this IP..." = Global limiter
   - "Please slow down. Maximum X requests..." = Proxy limiter

2. **Adjust the appropriate limiter:**
   - Global errors: Edit `src/server.ts` (unlikely with 1000/15min)
   - Proxy errors: Edit your `proxy.config.json`

3. **Lower the proxy limit** (recommended):

   ```json
   "rateLimit": {
     "max": 20  // Even more conservative
   }
   ```

### If Limits Are Too Restrictive

1. **Raise proxy limits:**

   ```json
   "rateLimit": {
     "max": 50,
     "windowMs": 60000
   }
   ```

2. **Or increase the window:**

   ```json
   "rateLimit": {
     "max": 60,
     "windowMs": 120000  // 2 minutes
   }
   ```

## Best Practices

1. ✅ **Keep global limit high** (1000+) - catches abuse without blocking users
2. ✅ **Keep proxy limits tight** (20-50) - respects backend limits
3. ✅ **Match backend capabilities** - check backend's actual rate limits
4. ✅ **Different limits per service** - some services can handle more load
5. ✅ **Monitor and adjust** - watch logs and tune as needed

## Example Configurations

### High-Traffic Public API

```typescript
// server.ts - Global
max: 5000, windowMs: 15 * 60 * 1000

// proxy.config.json - Per service
"rateLimit": { "max": 100, "windowMs": 60000 }
```

### Low-Traffic Internal Tool

```typescript
// server.ts - Global
max: 500, windowMs: 15 * 60 * 1000

// proxy.config.json - Per service
"rateLimit": { "max": 20, "windowMs": 60000 }
```

### Development/Testing

```typescript
// server.ts - Global
max: 10000, windowMs: 15 * 60 * 1000

// proxy.config.json - Disable
"rateLimit": { "enabled": false }
```

## Debugging

### Check Current Limits

**Server startup logs:**

```text
Server is running on http://localhost:4200
- Setting up proxies (custom config: public/proxy.config.json):
  ℹ Rate limit: 30 req/60s for /deployment-service
  ✓ /deployment-service → https://backend.example.com
```

**Response headers:**

```text
RateLimit-Limit: 30
RateLimit-Remaining: 25
RateLimit-Reset: 1729445678
```

### Common Issues

**Issue:** Getting 429 from global limiter
**Solution:** Increase global limit in `server.ts`

**Issue:** Getting 429 from proxy limiter
**Solution:** Reduce requests or increase proxy limit in config

**Issue:** Still getting backend 429s
**Solution:** Lower proxy limit below backend's limit

**Issue:** Rate limiting too aggressive in development
**Solution:** Disable proxy rate limiting:

```json
"rateLimit": { "enabled": false }
```
