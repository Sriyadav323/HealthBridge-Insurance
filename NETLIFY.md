# Deploy HealthBridge to Netlify

Connect Netlify to this repository and deploy the `main` branch. The root
`netlify.toml` configures the frontend base directory (`frontend`), build command
(`npm run build`), publish directory (`dist`, relative to the base), and Node 24.
Netlify must publish the compiled frontend, rather than the repository root.

After pulling these changes, trigger a new deploy in Netlify. If entering settings
manually, use the values above. For manual drag-and-drop deployment, run
`npm ci` and `npm run build` from `frontend`, then upload `frontend/dist`.
The included `_redirects` file supports direct visits and refreshes on React routes.

## Backend required for login and data

This deployment serves the React frontend. The Spring Boot backend and PostgreSQL
database must run on a separate service. The Vite localhost API proxy only works
in development and is not included in the production build.

Once your backend has a public HTTPS URL, add this rule at the top of
`frontend/public/_redirects`, replacing the example hostname:

```text
/api/* https://YOUR-BACKEND-HOST/api/:splat 200
/* /index.html 200
```

Keep the API rule before the React fallback. Configure the backend's database
environment variables on its hosting service and set `SESSION_COOKIE_SECURE=true`
for HTTPS. Keep `backend/.env.local` private; Netlify does not need database secrets.
