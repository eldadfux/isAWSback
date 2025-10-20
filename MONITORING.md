# Monitoring & Logging Guide for isAWSback.com

## Overview

This guide covers monitoring, logging, and alerting setup for isAWSback.com to ensure 99.5%+ uptime.

---

## 1. Server-Side Logging

### Current Implementation

✅ Already implemented in `src/server/functions/aws-health.ts`:

- All AWS API calls are logged with `console.log`
- Errors are logged with `console.error`
- Cache hits/misses are logged

### Production Logging Services

**Option 1: Built-in Platform Logging**

- **Vercel**: Automatic logging in dashboard
- **Netlify**: Function logs in dashboard
- **AWS**: CloudWatch Logs

**Option 2: External Logging Services**

- **Better Stack (Logtail)**: Modern, fast, affordable
- **Datadog**: Enterprise-grade
- **LogRocket**: Session replay + logging
- **Papertrail**: Simple, reliable

### Setup Example (Better Stack/Logtail)

```bash
# Install
bun add @logtail/node @logtail/pino

# Add to server function
import { Logtail } from '@logtail/node'
const logtail = new Logtail(process.env.LOGTAIL_TOKEN)

// Use in your code
logtail.info('Fetching AWS status')
logtail.error('Error fetching AWS status', { error })
```

---

## 2. Client-Side Error Tracking

### Recommended: Sentry

**Why Sentry?**

- Free tier available
- React integration
- Error grouping
- Source maps support
- Performance monitoring

### Installation

```bash
bun add @sentry/react
```

### Configuration

Create `src/lib/sentry.ts`:

```typescript
import * as Sentry from '@sentry/react'

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}
```

Import in `__root.tsx`:

```typescript
import './lib/sentry'
```

---

## 3. Uptime Monitoring

### Recommended Services

#### Option 1: UptimeRobot (Free)

- **Checks**: Every 5 minutes
- **Setup**:
  1. Go to uptimerobot.com
  2. Add monitor for https://isawsback.com
  3. Configure alerts (email, SMS, Slack)
  4. Set up status page (optional)

#### Option 2: Pingdom (Paid, more features)

- More detailed performance metrics
- Global check locations
- Transaction monitoring
- Real user monitoring

#### Option 3: Better Uptime (Modern, affordable)

- Beautiful status pages
- Incident management
- Team collaboration
- API for automation

### Recommended Alerts

- HTTP check every 1-5 minutes
- Alert if down for 2+ checks
- Email + SMS notifications
- Slack/Discord webhooks

---

## 4. Performance Monitoring

### Real User Monitoring (RUM)

**Add Web Vitals Tracking**

Already installed: `web-vitals` package

Create `src/lib/web-vitals.ts`:

```typescript
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals'

function sendToAnalytics(metric: any) {
  // Send to your analytics service
  console.log(metric)

  // Or send to Google Analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    ;(window as any).gtag('event', metric.name, {
      value: Math.round(metric.value),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_delta: metric.delta,
    })
  }
}

export function initWebVitals() {
  if (typeof window !== 'undefined') {
    onCLS(sendToAnalytics)
    onFID(sendToAnalytics)
    onFCP(sendToAnalytics)
    onLCP(sendToAnalytics)
    onTTFB(sendToAnalytics)
  }
}
```

---

## 5. Custom Monitoring Dashboard

### Option: Create Status History Page

Track and display historical AWS status:

**Add to backend** (`src/server/functions/aws-health.ts`):

```typescript
// Add after existing cache
let statusHistory: Array<{
  timestamp: string
  status: 'yes' | 'no' | 'unknown'
}> = []

// In fetchAWSHealthStatus, after determining status:
statusHistory.push({
  timestamp: new Date().toISOString(),
  status,
})

// Keep only last 24 hours
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
statusHistory = statusHistory.filter(
  (entry) => new Date(entry.timestamp).getTime() > oneDayAgo,
)
```

**Create endpoint to fetch history**:

```typescript
export const getAWSHealthHistoryFn = createServerFn({ method: 'GET' }).handler(
  () => {
    return { history: statusHistory }
  },
)
```

---

## 6. Alert Configuration

### Critical Alerts (Immediate Action)

- Site is down (4+ failed checks)
- 500 errors spike
- AWS API unreachable for 5+ minutes

### Warning Alerts (Review Soon)

- Slow response times (>3 seconds)
- High error rate (>5%)
- Cache misses spike

### Notification Channels

1. **Email**: Primary
2. **SMS**: Critical only
3. **Slack/Discord**: Team channel
4. **PagerDuty**: Enterprise on-call

---

## 7. Metrics to Track

### Application Metrics

- ✅ AWS API response time
- ✅ Cache hit ratio
- ✅ Error rate
- ✅ Auto-refresh success rate
- ✅ User sessions

### Infrastructure Metrics

- Server uptime
- Memory usage
- CPU usage
- Network latency
- Request rate

---

## 8. Implementation Checklist

### Immediate (Required)

- [ ] Set up uptime monitoring (UptimeRobot/Pingdom)
- [ ] Configure email alerts
- [ ] Test alert notifications

### Short-term (1 week)

- [ ] Add Sentry for error tracking
- [ ] Set up logging service (Logtail/Datadog)
- [ ] Create status history endpoint
- [ ] Add Web Vitals tracking

### Long-term (Optional)

- [ ] Build status history dashboard
- [ ] Add analytics (Google Analytics/Plausible)
- [ ] Create public status page
- [ ] Set up synthetic monitoring
- [ ] Add performance budgets

---

## 9. Cost Estimate

**Free Tier (Good for starting)**:

- UptimeRobot: Free (50 monitors)
- Sentry: Free (5K errors/month)
- Vercel logging: Free (included)
- Total: $0/month

**Basic Paid (Recommended)**:

- Better Uptime: $10/month
- Sentry Pro: $26/month
- Logtail: $5/month
- Total: ~$41/month

**Enterprise**:

- Pingdom: $15+/month
- Datadog: $15+/host/month
- PagerDuty: $25+/user/month
- Total: $55+/month

---

## 10. Quick Start (Free Tier)

### 1. UptimeRobot Setup (5 minutes)

```
1. Sign up at uptimerobot.com
2. Add HTTP(s) monitor
3. URL: https://isawsback.com
4. Interval: 5 minutes
5. Add email alert
6. Done!
```

### 2. Vercel Analytics (if using Vercel)

```
1. Go to Vercel dashboard
2. Select your project
3. Click "Analytics" tab
4. Enable Web Analytics
5. Done!
```

### 3. Browser Console Monitoring

```javascript
// Add to component for quick debugging
useEffect(() => {
  const checkInterval = setInterval(() => {
    console.log('[Monitor] Last fetch:', statusData?.lastUpdated)
    console.log('[Monitor] Current status:', statusData?.status)
  }, 60000) // Log every minute

  return () => clearInterval(checkInterval)
}, [statusData])
```

---

## 11. Incident Response

### When AWS Status Shows "NO"

1. Verify on official AWS Health Dashboard
2. Check if issue is widespread
3. Monitor auto-refresh continues working
4. Document incident start time

### When isAWSback.com is Down

1. Check uptime monitor alerts
2. Verify hosting provider status
3. Check server logs
4. Roll back recent deployments if needed
5. Communicate with users (Twitter, status page)

---

## Support Resources

- **Sentry Docs**: https://docs.sentry.io/platforms/javascript/guides/react/
- **UptimeRobot Docs**: https://uptimerobot.com/help/
- **Web Vitals**: https://web.dev/vitals/
- **Better Uptime**: https://betteruptime.com/docs
