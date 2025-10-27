# Deployment Checklist

Use this checklist to ensure successful deployment to Render.

## Pre-Deployment

- [ ] **Frontend builds successfully**
  ```bash
  npm run build:frontend
  ```
  - Should complete without errors
  - Creates `frontend/build/` directory

- [ ] **Backend dependencies installed**
  ```bash
  cd backend && npm install
  ```

- [ ] **Environment variables documented**
  - See `RENDER_DEPLOYMENT_GUIDE.md` for full list
  - Gather all credentials before starting

- [ ] **Code committed to Git**
  ```bash
  git add .
  git commit -m "Prepare for Render deployment"
  ```

- [ ] **Code pushed to GitHub**
  ```bash
  git push origin main
  ```

## Render Setup

- [ ] **Create Render account** at https://render.com
- [ ] **Connect GitHub account** to Render
- [ ] **Create new Web Service**
  - Repository: Your GitHub repo
  - Branch: `main`
  - Runtime: Node
  - Build command: `npm run build:all`
  - Start command: `npm run start:prod`
  - Plan: Starter ($7/month recommended)

## Environment Variables

### Required (Core Functionality)
- [ ] `NODE_ENV=production`
- [ ] `PORT=10000`
- [ ] `HEADLESS_MODE=true`
- [ ] `LABCORP_USERNAME=<your-username>`
- [ ] `LABCORP_PASSWORD=<your-password>`
- [ ] `INTAKEQ_API_KEY=<your-api-key>`

### Required (Medicaid Eligibility)
- [ ] `OFFICE_ALLY_USERNAME=moonlit`
- [ ] `OFFICE_ALLY_PASSWORD=h@i9hiS4}92PEwd5`
- [ ] `OFFICE_ALLY_SENDER_ID=1161680`
- [ ] `OFFICE_ALLY_PROVIDER_NPI=1275348807`
- [ ] `OFFICE_ALLY_ENDPOINT=https://wsd.officeally.com/TransactionService/rtx.svc`

### Optional (Enhanced Features)
- [ ] `GEMINI_API_KEY=<your-key>` (for smart form filling)
- [ ] `SUPABASE_URL=<your-url>` (for database)
- [ ] `SUPABASE_ANON_KEY=<your-key>`
- [ ] `SUPABASE_SERVICE_KEY=<your-key>`
- [ ] `SMTP_HOST=smtp.gmail.com` (for email notifications)
- [ ] `SMTP_USER=<your-email>`
- [ ] `SMTP_PASS=<your-password>`
- [ ] `NOTIFICATION_EMAIL=hello@trymoonlit.com`

## Post-Deployment Testing

- [ ] **Health check passes**
  - Visit: `https://your-app.onrender.com/health`
  - Should return JSON with service status

- [ ] **Frontend loads**
  - Visit: `https://your-app.onrender.com/`
  - Should see "Smart Lab Order" interface

- [ ] **API responds**
  - Visit: `https://your-app.onrender.com/api/lab-orders/available-tests`
  - Should return JSON with lab tests

- [ ] **Patient search works**
  - Search for a test patient
  - Should return results from IntakeQ

- [ ] **Medicaid eligibility works**
  - Select a patient
  - Should verify eligibility via Office Ally

- [ ] **Lab test search works**
  - Type "CMP" in test search
  - Should show "Comprehensive Metabolic Panel"

- [ ] **Test order submission**
  - Submit a test order
  - Watch Render logs for Labcorp automation
  - Should complete in 2-3 minutes

## Monitoring

- [ ] **Check Render logs** for errors
- [ ] **Monitor first 24 hours** for issues
- [ ] **Test during business hours** when Labcorp Link is accessible
- [ ] **Verify no cold start issues** (if using Free tier)

## Optimization (Optional)

- [ ] **Upgrade to Starter plan** ($7/month) for always-on service
- [ ] **Add custom domain** (e.g., labs.trymoonlit.com)
- [ ] **Enable auto-deploy** from GitHub main branch
- [ ] **Set up error notifications** via email

## Troubleshooting

If deployment fails, check:
- [ ] Build logs in Render dashboard
- [ ] Environment variables are set correctly
- [ ] GitHub repository is public or Render has access
- [ ] Node version is compatible (18+)

Common issues:
- **"Cannot find module"** → Build didn't complete, check build logs
- **Playwright fails** → Should auto-install Chromium, check build output
- **API calls fail** → Check CORS settings and environment variables
- **Frontend 404** → Make sure `NODE_ENV=production` is set

## Success Criteria

✅ Deployment completes without errors
✅ Health check endpoint returns 200 OK
✅ Frontend loads in browser
✅ Can search for patients
✅ Medicaid eligibility check works
✅ Can select tests and diagnoses
✅ Order submission triggers Labcorp automation
✅ Automation completes successfully
✅ Logs show no critical errors

---

## Quick Commands

```bash
# Test frontend build locally
npm run build:frontend

# Test full production build locally
npm run test:build

# Check build output
ls -la frontend/build/

# View backend logs (after deployment)
# Go to Render Dashboard → Your Service → Logs
```

---

*Ready to deploy? Follow `RENDER_DEPLOYMENT_GUIDE.md` for detailed instructions!*
