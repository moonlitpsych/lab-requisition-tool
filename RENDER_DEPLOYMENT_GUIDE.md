# Render Deployment Guide - MOONLIT Lab Portal

## Overview
This guide will help you deploy the full-stack MOONLIT Lab Portal application to Render.com.

**What gets deployed:**
- React frontend (Smart Lab Order interface)
- Express backend (API + Labcorp automation)
- Playwright browser automation
- Single web service serving both frontend and backend

**Cost:**
- **Free Tier**: $0/month (sleeps after 15 min inactivity, 750 hours/month)
- **Starter**: $7/month (always on, better performance) **← RECOMMENDED**

---

## Prerequisites

1. **GitHub account** (Render deploys from GitHub)
2. **Render account** (sign up at https://render.com)
3. **Your project pushed to GitHub**

---

## Step 1: Push Your Code to GitHub

If you haven't already:

```bash
cd /Users/macsweeney/lab-requisition-app

# Initialize git (if needed)
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for Render deployment"

# Create GitHub repo and push
# (Follow GitHub instructions to create a new repository)
git remote add origin https://github.com/YOUR_USERNAME/moonlit-lab-portal.git
git branch -M main
git push -u origin main
```

---

## Step 2: Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account (if not already connected)
4. Select your `moonlit-lab-portal` repository
5. Configure the service:

### Basic Settings
- **Name**: `moonlit-lab-portal`
- **Region**: Oregon (or closest to you)
- **Branch**: `main`
- **Runtime**: Node
- **Build Command**: `npm run build:all`
- **Start Command**: `npm run start:prod`

### Plan Selection
- **Free** (for testing) or **Starter** ($7/month, recommended for production)

---

## Step 3: Add Environment Variables

In the Render dashboard, scroll to **"Environment Variables"** and add these:

### Required Variables

#### Node Environment
```
NODE_ENV=production
PORT=10000
HEADLESS_MODE=true
```

#### Labcorp Credentials
```
LABCORP_USERNAME=<your-labcorp-username>
LABCORP_PASSWORD=<your-labcorp-password>
```

#### IntakeQ API
```
INTAKEQ_API_KEY=<your-intakeq-api-key>
```

#### Office Ally (Medicaid Eligibility)
```
OFFICE_ALLY_USERNAME=moonlit
OFFICE_ALLY_PASSWORD=h@i9hiS4}92PEwd5
OFFICE_ALLY_SENDER_ID=1161680
OFFICE_ALLY_PROVIDER_NPI=1275348807
OFFICE_ALLY_ENDPOINT=https://wsd.officeally.com/TransactionService/rtx.svc
```

### Optional Variables

#### Google Gemini (for LLM-assisted automation)
```
GEMINI_API_KEY=<your-gemini-api-key>
```

#### Supabase (for database)
```
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_KEY=<your-supabase-service-key>
```

#### Email Notifications (for automation failures)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your-email@gmail.com>
SMTP_PASS=<your-app-password>
SMTP_FROM_EMAIL=hello@trymoonlit.com
NOTIFICATION_EMAIL=hello@trymoonlit.com
```

---

## Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Clone your GitHub repo
   - Run `npm run build:all` (builds frontend, installs backend deps, installs Playwright)
   - Start the server with `npm run start:prod`
   - Assign you a URL like `https://moonlit-lab-portal.onrender.com`

**Build time:** 5-10 minutes (Playwright installation takes time)

---

## Step 5: Verify Deployment

Once deployed, test these URLs:

1. **Health Check**: `https://your-app.onrender.com/health`
   - Should return JSON with service status

2. **Frontend**: `https://your-app.onrender.com/`
   - Should load the Smart Lab Order interface

3. **API**: `https://your-app.onrender.com/api/lab-orders/available-tests`
   - Should return list of lab tests

---

## Troubleshooting

### Build Fails

**Issue**: `npm ERR! missing script: build:all`
**Fix**: Make sure you pushed the root `package.json` to GitHub

**Issue**: Playwright installation fails
**Fix**: Render should handle this automatically. Check build logs.

### Runtime Errors

**Issue**: "Cannot find module"
**Fix**: Check that both frontend and backend `node_modules` are installed

**Issue**: Labcorp automation fails
**Fix**: Check environment variables are set correctly in Render dashboard

### Frontend Not Loading

**Issue**: 404 on routes
**Fix**: Make sure `NODE_ENV=production` is set (this enables frontend serving)

**Issue**: API calls fail
**Fix**: Check browser console. API should call same domain (no `localhost:3001`)

---

## Monitoring & Logs

### View Logs
- Go to Render dashboard → Your service → **"Logs"** tab
- Live stream of server logs
- Shows Labcorp automation progress

### Disk Usage
- Render Free tier: 512 MB disk (should be enough)
- Screenshots are saved to `/test-screenshots/` (gets cleared on redeploy)

### Performance
- Free tier: Spins down after 15 min → 30-60 second cold start
- Starter ($7/mo): Always on, instant response

---

## Custom Domain (Optional)

1. Go to service → **"Settings"** → **"Custom Domains"**
2. Add your domain (e.g., `labs.trymoonlit.com`)
3. Add CNAME record to your DNS:
   ```
   CNAME labs.trymoonlit.com → moonlit-lab-portal.onrender.com
   ```
4. Render handles SSL automatically (free)

---

## Updating the App

### Auto-Deploy (Recommended)
- Push to GitHub `main` branch
- Render automatically rebuilds and redeploys
- No downtime (Render uses blue-green deployment)

### Manual Deploy
- Render dashboard → **"Manual Deploy"** → **"Deploy latest commit"**

---

## Environment Variables You'll Need

Here's a checklist of credentials to gather:

- [ ] Labcorp Link username/password
- [ ] IntakeQ API key (from IntakeQ settings)
- [ ] Office Ally credentials (already have these)
- [ ] Google Gemini API key (optional, for smart form filling)
- [ ] Supabase credentials (optional, for database)
- [ ] Email SMTP settings (optional, for failure notifications)

---

## Cost Breakdown

### Free Tier ($0/month)
- 750 hours/month (enough for one service)
- Spins down after 15 min inactivity
- 512 MB RAM
- Good for: Testing, low-traffic apps

### Starter ($7/month) **← RECOMMENDED**
- Always on (no spin-down)
- 512 MB RAM
- Faster builds
- Good for: Production use, 20-30 patients/month

### Pro ($25/month)
- 2 GB RAM
- Priority support
- Good for: High volume, concurrent automation

---

## Security Notes

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Use Render's environment variables** - Encrypted at rest
3. **Rotate credentials** - Especially Labcorp password
4. **Enable auto-deploy** - Always run latest code

---

## Next Steps After Deployment

1. **Test patient search** - Make sure IntakeQ integration works
2. **Test Medicaid eligibility** - Office Ally API should work
3. **Submit test order** - Watch logs for Labcorp automation
4. **Monitor for 24 hours** - Check for errors in logs
5. **Upgrade to Starter plan** - If everything works well

---

## Support

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **Playwright on Render**: https://render.com/docs/deploy-playwright

---

## Summary

✅ Code pushed to GitHub
✅ Render service created
✅ Environment variables configured
✅ App deployed successfully
✅ Health check passes
✅ Frontend loads
✅ API responds
✅ Labcorp automation working

**Your app is live!** 🎉

Access it at: `https://moonlit-lab-portal.onrender.com`

---

*Last updated: October 25, 2025*
