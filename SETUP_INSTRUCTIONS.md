# Lab Portal Automation - Quick Setup Instructions

## For Claude Code: Getting Started

### Step 1: Prepare the Backend
```bash
cd backend
npm install playwright dotenv @playwright/test
npx playwright install chromium
```

### Step 2: Create/Update .env file
```bash
# Add these to backend/.env
LABCORP_USERNAME=your_username_here
LABCORP_PASSWORD=your_password_here
QUEST_USERNAME=your_quest_username
QUEST_PASSWORD=your_quest_password
OPENAI_API_KEY=optional_for_now
HEADLESS_MODE=false
```

### Step 3: Run the Test Script
```bash
# Copy test-setup.js to backend directory
cp test-setup.js backend/
cd backend
node test-setup.js
```

### Step 4: Review the Output
The script will:
- ✅ Check all dependencies
- ✅ Verify environment variables
- ✅ Test database connection
- ✅ Attempt to log into Labcorp Link
- ✅ Attempt to log into Quest (if credentials provided)
- ✅ Save screenshots in `./test-screenshots/`

### Step 5: Analyze Screenshots
Check the `test-screenshots` folder:
- `labcorp-01-login-page.png` - Shows the login form
- `labcorp-02-filled-form.png` - Shows form with credentials (for debugging)
- `labcorp-03-dashboard.png` - Success! Shows logged-in state
- `labcorp-error.png` - If login failed, shows the error

### What Success Looks Like
```
═══ Test Summary ═══

✅ Passed: 12 tests
⚠️  Warnings: 2 items  (optional features)
❌ Failed: 0 tests

✓ All required tests passed! You're ready to build the automation.
```

### Common Issues & Fixes

#### "Missing required package: playwright"
```bash
npm install playwright
```

#### "LABCORP_USERNAME is missing"
Add credentials to `.env` file

#### "Login failed: timeout exceeded"
- Check internet connection
- Verify credentials are correct
- Portal might be down - check manually

#### "Could not find username field"
- Portal UI may have changed
- Check the screenshot to see current form
- Update selectors in automation code

### Next Steps After Successful Test

1. **If all tests pass**: Start building with CLAUDE.md instructions
2. **If Labcorp works but Quest fails**: Focus on Labcorp-only MVP
3. **If login works but can't find buttons**: Portal UI changed - adapt selectors

### Quick Commands for Development

```bash
# Run test in headless mode (no browser window)
HEADLESS_MODE=true node test-setup.js

# Run test with specific portal only
SKIP_QUEST=true node test-setup.js

# Clean up test artifacts
rm -rf test-screenshots/

# Watch mode for development
npx nodemon test-setup.js
```

## Important Notes for Claude Code

1. **Start Simple**: Get Labcorp working first, then add Quest
2. **Save Screenshots**: Always capture screenshots for debugging
3. **Handle Errors**: Portals change - expect selectors to break
4. **Use the LLM**: When selectors fail, use GPT-4 to find new ones
5. **Test Often**: Run test-setup.js after any major changes

## File Structure You'll Build

```
backend/
  test-setup.js                 ← Start here
  test-screenshots/            ← Check these
  .env                        ← Add credentials
  src/
    services/
      portalAutomation.js    ← Build this next
      labcorpAgent.js        ← Then this
      questAgent.js          ← Finally this
```

## Ready to Build!

Once test-setup.js shows all green checks, you're ready to build the full automation following CLAUDE.md instructions.

Remember: Portal automation is fragile by nature - that's why we use LLM to adapt!