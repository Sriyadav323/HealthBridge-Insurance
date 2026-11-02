# HealthBridge frontend

See the [root README](../README.md) for architecture, authentication, setup, environment variables, Docker, testing, and deployment preparation.

From this directory:

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

Development uses `http://localhost:5173`, proxying `/api` to `http://localhost:8081`. The backend must be running and a synthetic member account must have been provisioned. Do not store credentials in frontend code or `VITE_*` variables.
