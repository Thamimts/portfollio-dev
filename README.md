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

Files added in this update:
- `frontend/project.html` — project detail page loaded from `/api/projects`
- `frontend/por.js` — now renders projects dynamically and links to details
- `backend/Dockerfile` — container recipe for the backend
- `.github/workflows/node-ci.yml` — basic CI that starts the server and hits `/api/health`
