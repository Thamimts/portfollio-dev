# Personal Portfolio (local development)

Quick steps to run locally and enable persistence:

- Install dependencies:

```bash
cd backend
npm install
```

- Copy `backend/.env.example` to `backend/.env` and fill in values (Mongo URI).

- For MongoDB Atlas: URL-encode your password if it contains special characters. Example (Node):

- Start the server:

```bash
cd backend
npm start
```

Open `http://localhost:5000` in your browser.

## Vercel + Render deployment

If you host the frontend on Vercel and the backend on Render, set the Vercel environment variable `RENDER_BACKEND_URL` to your Render service URL, for example `https://your-backend.onrender.com`.

The frontend and admin pages call relative `/api/*` routes. On Vercel, those requests are proxied by the serverless function in `api/[...path].js` to your Render backend.

Important: if your Vercel project is configured with a root directory other than the repository root, make sure the `api/` folder is inside that root so the proxy function is deployed.

Files added in this update:
- `frontend/project.html` — project detail page loaded from `/api/projects`
- `frontend/por.js` — now renders projects dynamically and links to details
- `backend/Dockerfile` — container recipe for the backend
- `.github/workflows/node-ci.yml` — basic CI that starts the server and hits `/api/health`
