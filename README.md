# Downly

A modern web application for downloading media from various platforms.

## Project Structure

```
downly/
├── backend/          # Backend API server (Express + TypeScript)
├── frontend/         # Frontend application (Next.js + React)
└── netlify.toml      # Netlify deployment configuration
```

## Frontend Deployment (Netlify)

The frontend is configured for static deployment on Netlify.

### Prerequisites

- Node.js 18+ installed
- Netlify account
- Backend API deployed and accessible

### Build Configuration

- **Base Directory**: `frontend`
- **Build Command**: `npm run build`
- **Publish Directory**: `frontend/out`

These settings are configured in `netlify.toml` at the repository root.

### Environment Variables

Before deploying to Netlify, you must set the following environment variable in the Netlify dashboard:

#### Required

- `NEXT_PUBLIC_API_URL` - The production backend API URL (e.g., `https://your-api.example.com`)

**Important**: This environment variable must be set in the Netlify dashboard before deployment. Without it, the frontend will not be able to communicate with the backend API.

### Deployment Steps

#### Step 1: Connect Repository to Netlify

1. **Log in to Netlify**
   - Go to [https://app.netlify.com](https://app.netlify.com)
   - Sign in with your account (GitHub, GitLab, Bitbucket, or email)

2. **Import Project**
   - Click **"Add new site"** button (top right)
   - Select **"Import an existing project"**
   - Choose your Git provider (GitHub, GitLab, or Bitbucket)
   - Authorize Netlify to access your repositories if prompted

3. **Select Repository**
   - Search for and select the `downly` repository
   - Click **"Next"**

#### Step 2: Configure Build Settings

Netlify will automatically detect `netlify.toml` and use these settings:

- **Base directory**: `frontend`
- **Build command**: `npm run build`
- **Publish directory**: `frontend/out`
- **Node version**: `18` (configured in `netlify.toml`)

**Verify these settings are correct:**
- In the "Configure build" section, you should see:
  - Base directory: `frontend`
  - Build command: `npm run build`
  - Publish directory: `frontend/out`
- If these don't appear automatically, manually enter them

4. Click **"Show advanced"** (optional, if settings need manual entry)
5. Verify or set:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/out`

6. Click **"Deploy site"** to start the first deployment

**Note**: The first deployment may fail because `NEXT_PUBLIC_API_URL` is not set yet. This is expected. We'll set it in the next step.

#### Step 3: Set Environment Variables

1. **Navigate to Site Settings**
   - After the site is created, go to your site dashboard
   - Click **"Site configuration"** in the top navigation
   - Click **"Environment variables"** in the left sidebar

2. **Add Environment Variable**
   - Click **"Add variable"** button
   - Enter the following:
     - **Key**: `NEXT_PUBLIC_API_URL`
     - **Value**: Your production backend API URL (e.g., `https://api.yourdomain.com` or `https://your-backend.herokuapp.com`)
   - Select scope:
     - **All scopes** (recommended) - applies to all deployments
     - Or select specific branches if needed

3. **Save**
   - Click **"Save"** button

**Important Notes:**
- The value should be the full URL without a trailing slash (e.g., `https://api.example.com`, not `https://api.example.com/`)
- Do not include `/api` in the URL - the frontend code adds it automatically
- The variable is available at build time (because it starts with `NEXT_PUBLIC_`)
- You must redeploy after adding/changing environment variables

#### Step 4: Redeploy with Environment Variables

1. **Trigger New Deployment**
   - Go to **"Deploys"** tab in your site dashboard
   - Click **"Trigger deploy"** button (top right)
   - Select **"Deploy site"**
   - Or push a new commit to trigger automatic deployment

2. **Monitor Build**
   - Watch the build logs in real-time
   - Build should complete successfully
   - Look for: `✓ Generating static pages` and `✓ Export successful`

#### Step 5: Verify Deployment

Use this checklist to verify your deployment is working correctly:

##### Build Verification
- [ ] Build completed successfully (green checkmark in Netlify dashboard)
- [ ] No build errors or warnings in build logs
- [ ] Build log shows: `✓ Generating static pages`
- [ ] Build log shows: `✓ Export successful`
- [ ] Build log shows pages generated: `/`, `/privacy`, `/terms`

##### Site Accessibility
- [ ] Site URL is accessible (click "Open production deploy" in Netlify)
- [ ] Homepage loads without errors
- [ ] No console errors in browser DevTools (F12 → Console tab)
- [ ] Privacy Policy page loads (`/privacy`)
- [ ] Terms of Service page loads (`/terms`)

##### Environment Variable Verification
- [ ] Check browser console for `NEXT_PUBLIC_API_URL` related errors (should be none)
- [ ] Open browser DevTools → Console
- [ ] Look for any messages about missing API URL (there should be none if configured correctly)

##### API Connectivity Test
- [ ] Open browser DevTools → Network tab
- [ ] Try to analyze a media URL on the homepage
- [ ] Verify API calls are made to the correct backend URL
- [ ] Check that requests use your production backend URL (not localhost)
- [ ] API calls should succeed (if backend is running) or show appropriate error messages (if backend is down)

##### Functionality Verification
- [ ] URL input field is visible and functional
- [ ] Batch mode toggle works
- [ ] Analyze button works (if backend is available)
- [ ] Images/thumbnails load correctly (Instagram proxy working)
- [ ] Queue panel appears (bottom right, if backend is available)
- [ ] Download history panel appears (bottom left)
- [ ] Dark mode toggle works
- [ ] Mobile responsiveness works (test on mobile or browser DevTools device mode)

##### Static Assets
- [ ] CSS styles load correctly
- [ ] JavaScript bundles load (check Network tab for `/_next/static/chunks/`)
- [ ] Favicon displays correctly
- [ ] No 404 errors for static assets

##### Common Issues to Check
- [ ] If API calls fail: Verify `NEXT_PUBLIC_API_URL` is set correctly in Netlify dashboard
- [ ] If images don't load: Check backend proxy endpoint is accessible
- [ ] If build fails: Check Node.js version matches (should be 18)
- [ ] If site doesn't load: Check publish directory is `frontend/out`

### Automatic Deployments

After initial setup, Netlify will automatically deploy on every push to your repository:
- Pushes to main/master branch → Production deployment
- Pull requests → Preview deployments
- Each deployment uses the environment variables you configured

To disable automatic deployments:
1. Go to **Site configuration** → **Build & deploy**
2. Click **"Continuous Deployment"**
3. Click **"Stop auto publishing"** (optional)

### Post-Deployment Verification Checklist

After deploying to Netlify, run through this quick checklist to verify everything works:

#### 1. Frontend Loads
- [ ] Visit your Netlify domain (e.g., `https://your-site.netlify.app`)
- [ ] Homepage loads without errors
- [ ] No blank page or loading spinner stuck

#### 2. Analyze Functionality
- [ ] Paste a test media URL (YouTube, Instagram, etc.)
- [ ] Click "Analyze" button
- [ ] Analysis completes successfully
- [ ] Media metadata displays (title, thumbnail, duration, formats)

#### 3. Queue System
- [ ] Queue panel is visible (bottom right corner)
- [ ] After analyzing, items appear in queue
- [ ] Queue shows job status correctly
- [ ] Queue updates in real-time

#### 4. Progress Updates
- [ ] Start a download or conversion
- [ ] Progress bar appears and updates
- [ ] Progress percentage increases
- [ ] Progress updates smoothly (no freezing)

#### 5. Downloads Start
- [ ] Select a format and click download
- [ ] Download starts in browser
- [ ] File downloads successfully
- [ ] Download history records the download (bottom left panel)

#### 6. Instagram Thumbnails
- [ ] Paste an Instagram post URL
- [ ] Analyze the Instagram URL
- [ ] Thumbnail image loads correctly
- [ ] No broken image icons

#### 7. No CORS Errors
- [ ] Open browser DevTools (F12) → Console tab
- [ ] Perform actions (analyze, download, queue operations)
- [ ] Check console for CORS errors (should see none)
- [ ] Check Network tab for failed requests (should see none related to CORS)

**Quick Test:**
1. Open your Netlify site
2. Open DevTools (F12) → Console tab
3. Paste a test URL (e.g., a YouTube video)
4. Click "Analyze"
5. Start a download
6. Verify all checks above pass

**If any check fails:**
- See the [Troubleshooting](#troubleshooting) section for detailed solutions
- Check that `NEXT_PUBLIC_API_URL` is set correctly in Netlify dashboard
- Verify backend is running and accessible
- Check backend CORS configuration includes your Netlify domain

### Local Development

To run the frontend locally:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3000` and connect to the backend at `http://localhost:3001` (configured via `.env.local`).

### Building Locally

To build the frontend for production:

```bash
cd frontend
npm run build
```

The static files will be generated in `frontend/out/`.

### Build Settings Reference

These settings are automatically applied via `netlify.toml`. If you need to set them manually in Netlify dashboard:

| Setting | Value | Notes |
|---------|-------|-------|
| **Base directory** | `frontend` | Where to run the build command |
| **Build command** | `npm run build` | Next.js production build |
| **Publish directory** | `frontend/out` | Static export output directory |
| **Node version** | `18` | Configured in `netlify.toml` |

**Location in Netlify Dashboard:**
- Site configuration → Build & deploy → Continuous Deployment
- Click "Edit settings" next to your connected branch

### Deployment Notes

- The frontend is configured for static export (`output: 'export'` in `next.config.js`)
- All API calls use `NEXT_PUBLIC_API_URL` environment variable
- No server-side rendering or API routes are used
- Images are unoptimized for static export compatibility
- All pages are pre-rendered at build time
- Static files are served directly by Netlify CDN

### Troubleshooting

#### Build Fails

**Symptoms:**
- Build shows red "Failed" status in Netlify dashboard
- Build logs show errors

**Solutions:**
1. Check build logs for specific error messages
2. Ensure `NEXT_PUBLIC_API_URL` is set in Netlify dashboard (even if first deployment fails)
3. Verify Node.js version matches (configured in `netlify.toml` as Node 18)
4. Check that all dependencies are in `package.json` (run `npm install` locally to verify)
5. Ensure `frontend/package.json` exists and is valid
6. Verify `frontend/next.config.js` is correct (static export enabled)

**Common Build Errors:**
- **"Cannot find module"**: Dependencies not installed - check `package.json`
- **"Module not found"**: Missing dependency - add to `package.json` and commit
- **TypeScript errors**: Fix TypeScript errors locally first, then commit
- **Environment variable error**: Set `NEXT_PUBLIC_API_URL` in Netlify dashboard

**How to Check Build Logs:**
1. Go to Netlify dashboard → Your site
2. Click **"Deploys"** tab
3. Click on the failed deployment
4. Review build logs for error messages

#### API Calls Fail After Deployment

**Symptoms:**
- Frontend loads but API requests fail
- Browser console shows CORS errors or network errors
- Analyze/download functionality doesn't work

**Solutions:**
1. **Verify Environment Variable:**
   - Go to Netlify dashboard → Site configuration → Environment variables
   - Confirm `NEXT_PUBLIC_API_URL` is set
   - Verify the URL is correct (no trailing slash, full URL)
   - Redeploy after changing environment variables

2. **Check Backend Accessibility:**
   - Test backend URL directly in browser (should respond, even if 404)
   - Verify backend is running and accessible from internet
   - Check backend logs for incoming requests

3. **CORS Configuration:**
   - Ensure backend CORS allows requests from your Netlify domain
   - Backend should allow: `https://your-site.netlify.app` and `https://your-custom-domain.com`
   - Check backend CORS configuration includes Netlify domain

4. **Check Browser Console:**
   - Open browser DevTools (F12) → Console tab
   - Look for API call errors
   - Check Network tab to see actual API URLs being called
   - Verify URLs point to production backend (not localhost)

#### Environment Variable Not Working

**Symptoms:**
- API calls use localhost or empty URL
- Console shows "NEXT_PUBLIC_API_URL is not set" error

**Solutions:**
1. **Verify Variable is Set:**
   - Netlify dashboard → Site configuration → Environment variables
   - Confirm `NEXT_PUBLIC_API_URL` exists and has correct value
   - Variable name must be exactly `NEXT_PUBLIC_API_URL` (case-sensitive)

2. **Redeploy Required:**
   - Environment variables are injected at build time
   - You must trigger a new deployment after adding/changing variables
   - Go to Deploys tab → Trigger deploy → Deploy site

3. **Check Variable Scope:**
   - Ensure variable scope includes production branch
   - Variables can be scoped to specific branches or contexts
   - For production, use "All scopes" or include your main branch

4. **Verify Variable Format:**
   - Should be full URL: `https://your-backend.com`
   - No trailing slash
   - Use `https://` or `http://` protocol
   - Do not include `/api` path (added by frontend code)

#### Site Loads But Shows Blank Page

**Symptoms:**
- Netlify shows successful deployment
- Site URL loads but shows blank/white page
- No console errors visible

**Solutions:**
1. Check browser console for JavaScript errors (F12 → Console)
2. Verify publish directory is `frontend/out` in Netlify settings
3. Check that `index.html` exists in `frontend/out/`
4. Verify static files are being served correctly
5. Check Netlify build logs for warnings about missing files

#### Images/Thumbnails Don't Load

**Symptoms:**
- Media thumbnails show broken image icons
- Image proxy requests fail

**Solutions:**
1. Verify backend image proxy endpoint is accessible: `/api/proxy/image`
2. Check backend logs for proxy requests
3. Verify CORS allows image requests
4. Test proxy endpoint directly: `https://your-backend.com/api/proxy/image?url=...`
5. Check browser Network tab to see proxy request URLs

#### Build Settings Not Applied

**Symptoms:**
- Netlify uses wrong build command or directory
- Build fails with "package.json not found"

**Solutions:**
1. Verify `netlify.toml` exists in repository root
2. Check `netlify.toml` syntax is correct (TOML format)
3. In Netlify dashboard, manually set:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/out`
4. Netlify should detect `netlify.toml` automatically, but manual override is available

**How to Manually Set Build Settings:**
1. Go to Netlify dashboard → Site configuration
2. Click **"Build & deploy"** in left sidebar
3. Click **"Continuous Deployment"**
4. Click **"Edit settings"** next to your connected branch
5. Enter build settings manually if needed

## Backend

The backend is a separate Express.js API server and is not deployed via Netlify. Deploy the backend separately according to your hosting preferences.

## License

[Add your license here]

