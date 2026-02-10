# Deploy to Railway

## One-time setup

1. **Create a Railway account**: https://railway.app (can sign in with GitHub)

2. **Install Railway CLI** (optional, can also use web dashboard):
   ```bash
   npm install -g @railway/cli
   railway login
   ```

3. **Create a new project on Railway**:
   - Go to https://railway.app/new
   - Click "Deploy from GitHub repo" (or "Empty project" if not using Git)

4. **Set environment variable**:
   - In your Railway project, go to Variables
   - Add: `ANTHROPIC_API_KEY` = your API key

5. **Deploy**:

   **Option A - From GitHub:**
   - Connect your GitHub repo
   - Railway will auto-deploy on push

   **Option B - From CLI:**
   ```bash
   cd /path/to/Enginering_Practice
   railway up
   ```

6. **Get your URL**:
   - Railway will give you a URL like `https://your-app.up.railway.app`
   - Access this from your phone, laptop, anywhere!

## Notes

- Railway free tier gives you $5/month of usage
- Sessions are stored in the container (will reset on redeploy)
- For persistent sessions, you'd need to add a database or external storage

## Local development

Backend: `cd backend && source venv/bin/activate && python main.py`
Mobile frontend: `cd mobile && npm run dev`
Desktop frontend: `cd frontend && npm run dev`
