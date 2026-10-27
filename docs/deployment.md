# Deploying ReeSolve: backend on Render (free), frontend on Vercel

The two halves deploy to different places because they need different things:

| Half | Where | Why |
|---|---|---|
| **Frontend** (React + Vite, static files) | **Vercel** | Static hosting is exactly what Vercel is for. |
| **Backend** (FastAPI + SQLite + SLA watchdog) | **Render** (free web service) | It needs one long-running process: the simulated clock lives in memory and the watchdog is a background thread. Vercel's serverless functions cannot run that. |

```
Browser  --->  https://<project>.vercel.app   (static UI)
                      |  fetch(VITE_API_URL)
                      v
               https://reesolve-api.onrender.com   (FastAPI, one worker, SQLite on ephemeral disk)
```

**Order matters** (each step needs a URL from the one before): 1. Render, 2. Vercel, 3. tell Render about Vercel.

## Step 0: put the deployment files on GitHub

Render and Vercel both deploy from GitHub, so these must be pushed to `main`: `render.yaml` (repo root),
`frontend/vercel.json`, and the backend settings in `backend/app/config.py` / `main.py`. Your repo must be reachable by
the Render and Vercel GitHub apps (grant access to this repository when they ask).

## Step 1: backend on Render

1. Create an account at <https://render.com> (sign in with GitHub is easiest).
2. **New, then Blueprint**, pick the repository, branch `main`. Render reads `render.yaml` and shows one service,
   **reesolve-api** (type *Web Service*, plan *Free*, root directory `backend`).
3. It asks for `CORS_ORIGINS`. Enter `http://localhost:5173` for now (you will replace it in step 3).
4. **Apply.** The first build takes a few minutes (it installs scikit-learn and SciPy).
5. When it says **Live**, copy the service URL, for example `https://reesolve-api.onrender.com`
   (Render may add a suffix; use exactly what it shows).
6. Check it in a browser:
   - `<url>/api/health` returns `{"status":"ok"}`
   - `<url>/api/incidents` returns a list of 12 incidents (the demo data, loaded automatically on startup)
   - `<url>/docs` shows the interactive API docs

What `render.yaml` sets, in case you prefer to create the service by hand: runtime *Python*, root directory `backend`,
build command `pip install -r requirements.txt`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
(**one worker only**), health check `/api/health`, and the environment variables below.

| Variable | Value | Purpose |
|---|---|---|
| `PYTHON_VERSION` | `3.12.8` | Python 3.12 (tested). If Render rejects the patch number, use any 3.12.x it lists. |
| `AUTO_SEED` | `true` | Reloads the 12 demo incidents on every cold start (the free disk resets). Safe: does nothing if data exists. |
| `CORS_ORIGINS` | your Vercel URL | Which websites may call the API. Set in step 3. |
| `DB_URL` | *(unset)* | Default `sqlite:///./reesolve.db`. |

## Step 2: frontend on Vercel

**Dashboard route**

1. Create an account at <https://vercel.com> and **Add New, then Project**, then import the repository.
2. Set **Root Directory** to `frontend`. The framework is detected as Vite; `frontend/vercel.json` supplies the build
   settings and the rewrite that makes deep links such as `/admin` work.
3. Under **Environment Variables** add **`VITE_API_URL`** = your Render URL from step 1, with **no trailing slash**
   (for example `https://reesolve-api.onrender.com`).
4. **Deploy.** Copy the production URL, for example `https://reesolve.vercel.app`.

**Command-line route** (from the `frontend/` folder)

```bash
npx vercel login
npx vercel link                          # root directory: the current folder (frontend)
npx vercel env add VITE_API_URL production    # paste the Render URL, no trailing slash
npx vercel --prod
```

`VITE_API_URL` is baked into the build, so **changing it requires a redeploy** of the frontend.

## Step 3: tell the backend about the frontend (CORS)

In the Render dashboard, open **reesolve-api, then Environment**, and set

```
CORS_ORIGINS = https://<your-project>.vercel.app
```

Use the exact origin: `https://`, no path, no trailing slash. Separate several with commas, for example
`https://reesolve.vercel.app,http://localhost:5173` to keep local development working. Save; Render redeploys the
service in about a minute and reloads the demo data.

## Step 4: check it works

1. Open the Vercel URL. The login page loads (the tricolour stripe, "Welcome back").
2. Click **Try as admin**. The Admin page shows 12 incidents, the New Delhi map with pins, and a live feed.
3. Open `<vercel-url>/admin` directly in a new tab: it should load, not 404.
4. Browser developer tools, Console: no `CORS` or `Failed to fetch` errors.
5. Run the story from [`demo-script.md`](demo-script.md), starting with **Reset demo** then **Load seed data**.

## Things to know about the free tier

- **It sleeps.** A free Render service spins down after about 15 minutes without traffic. The first request afterwards
  takes roughly 30 to 60 seconds. **Open the site two minutes before you present** to wake it.
- **The disk resets** whenever it sleeps, restarts or redeploys. The database and the simulated clock go back to the
  baseline (`AUTO_SEED` reloads the 12 incidents). Anything created during a demo is lost. That is fine for a demo.
- **No uptime guarantee.** Optionally point a free uptime monitor at `<url>/api/health` every 10 minutes to keep it awake.
- **One worker only.** Do not raise the worker count: each worker would keep its own simulated clock.
- **Preview deployments** on Vercel get different URLs that `CORS_ORIGINS` does not list, so only the production
  URL works unless you add the others.

## Security note

The prototype has no real authentication. Once the backend is public, **anyone who knows the URL can call
`/api/admin/reset` and the clock endpoints** and wipe or move the demo. Share the link only with the people who need
it, and delete the services after the event (below). The UI's sign-in is a demo and does not protect the API.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Page loads but shows no data, console says `CORS` | `CORS_ORIGINS` does not match the Vercel origin exactly (check `https`, trailing slash, spelling). Fix it on Render. |
| Console says `Failed to fetch` or mixed content | `VITE_API_URL` is missing, wrong, or `http://`. It must be the `https://` Render URL; redeploy Vercel after changing it. |
| Everything is slow or empty at first | Render is waking up. Open `<render-url>/api/health` and wait for it. |
| `/admin` returns 404 on refresh | Vercel Root Directory is not `frontend`, so `vercel.json` is not applied. |
| Render build fails installing scikit-learn | Check `PYTHON_VERSION` is a 3.12.x version Render supports. |
| Incidents disappeared | The free disk reset. They reload automatically; changes made live are gone. |
| Clock jumped back to real time | Same cause: a restart resets the simulated clock. |

## Updating and tearing down

- **Update:** push to `main`. Render (`autoDeploy: true`) and Vercel (Git integration) both rebuild automatically.
- **Tear down:** Render dashboard, *reesolve-api*, **Settings, Delete Web Service**. Vercel dashboard, the project,
  **Settings, Delete Project**. Both are free, so nothing is billed either way.
