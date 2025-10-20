# Deployment Guide for isAWSback.com

## Overview

This application is ready for deployment to production. It's a TanStack Start app with server-side rendering and API routes.

## Recommended Hosting Options

### Option 1: Vercel (Recommended)

**Pros**: Automatic deployments, built-in CDN, SSL, simple setup
**Cons**: None for this use case

**Steps**:

1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Build the app: `bun run build`
4. Deploy: `vercel --prod`
5. Configure domain in Vercel dashboard
6. Point isAWSback.com DNS to Vercel

**Environment Variables**: None required for this app

---

### Option 2: Netlify

**Pros**: Similar to Vercel, easy setup
**Cons**: May require adapter configuration

**Steps**:

1. Build: `bun run build`
2. Deploy to Netlify via CLI or dashboard
3. Configure domain in Netlify dashboard
4. Point DNS to Netlify

---

### Option 3: AWS (Ironic Choice!)

**Pros**: Full control, auto-scaling
**Cons**: More complex setup

**Services to use**:

- AWS Lambda + API Gateway (serverless functions)
- CloudFront (CDN)
- Route53 (DNS)
- ACM (SSL Certificate)

**Steps**:

1. Build: `bun run build:node`
2. Deploy Lambda functions
3. Configure API Gateway
4. Set up CloudFront distribution
5. Configure Route53 domain
6. Set up SSL certificate via ACM

---

### Option 4: Self-Hosted (VPS/Docker)

**Pros**: Full control, predictable costs
**Cons**: Manual maintenance

**Steps**:

1. Build: `bun run build`
2. Copy built files to server
3. Run: `bun run start`
4. Set up Nginx/Caddy reverse proxy
5. Configure SSL with Let's Encrypt
6. Point domain to server IP

---

## DNS Configuration

For isAWSback.com, you'll need to:

1. **A Record** (if using VPS):
   - Type: A
   - Name: @
   - Value: [Your server IP]

2. **CNAME Record** (if using Vercel/Netlify):
   - Type: CNAME
   - Name: @
   - Value: [Your Vercel/Netlify domain]

3. **WWW Subdomain** (optional):
   - Type: CNAME
   - Name: www
   - Value: isAWSback.com

---

## SSL/HTTPS

All recommended hosting providers (Vercel, Netlify, AWS) provide automatic SSL certificates via Let's Encrypt.

For self-hosted:

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d isawsback.com -d www.isawsback.com
```

---

## Build Commands

- **Development**: `bun run dev`
- **Build for Vercel/Netlify**: `bun run build`
- **Build for Node.js**: `bun run build:node`
- **Start production**: `bun run start`

---

## Performance Optimizations

The app is already optimized with:

- ✅ Server-side caching (10 seconds)
- ✅ Client-side data fetching with TanStack Query
- ✅ Minimal bundle size
- ✅ Auto-refresh every 30 seconds (configurable)
- ✅ Responsive design with Tailwind CSS

---

## Monitoring Setup (See TODO 7)

After deployment, set up:

- Uptime monitoring (UptimeRobot, Pingdom, or similar)
- Error tracking (Sentry)
- Analytics (optional)

---

## Post-Deployment Checklist

- [ ] Domain DNS configured and propagated
- [ ] SSL certificate active
- [ ] App loads correctly at isAWSback.com
- [ ] Test on mobile and desktop
- [ ] Verify auto-refresh works
- [ ] Check AWS status detection accuracy
- [ ] Set up uptime monitoring
- [ ] Share the site!

---

## Quick Deploy with Vercel (Fastest)

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Then configure your domain in the Vercel dashboard.

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Check server logs
3. Verify AWS Health Dashboard API is accessible
4. Test locally first: `bun run dev`
