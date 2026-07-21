# GovMap Demo

A React + Vite app that renders a map using the [GovMap JavaScript API](https://api.govmap.gov.il/docs/intro/javascript-functions) (`govmap.createMap`), deployable to GitHub Pages.

## How it works

- [`src/govmap.js`](src/govmap.js) injects the official GovMap CDN script
  (`https://www.govmap.gov.il/govmap/api/govmap.api.js`) once and resolves when the
  global `govmap` object is ready. Per the docs, the script is loaded from the CDN
  and never bundled locally.
- [`src/components/GovMap.jsx`](src/components/GovMap.jsx) calls `govmap.createMap`
  with your token and options, and shows loading / error states.
- The token is read from the `VITE_GOVMAP_TOKEN` environment variable.

## Getting started

```bash
npm install
cp .env.example .env    # then edit .env and set your token
npm run dev
```

### Token (env)

The GovMap token is **domain-specific** and read from `VITE_GOVMAP_TOKEN`.

- **Local:** put it in `.env` (git-ignored):

  ```
  VITE_GOVMAP_TOKEN=your-token
  ```

- **GitHub Pages:** add a repository secret named `VITE_GOVMAP_TOKEN` under
  **Settings → Secrets and variables → Actions**. Note the token must be
  authorized for your GitHub Pages domain (`https://<user>.github.io`).

> Vite only exposes env vars prefixed with `VITE_` to client code, and the value
> is inlined into the built JavaScript — appropriate for GovMap's domain-scoped
> browser tokens.

## Build

```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

## Deploy to GitHub Pages

1. Push to the `main` branch. The workflow in
   [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and deploys automatically.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Add the `VITE_GOVMAP_TOKEN` secret (see above).

The workflow sets Vite's `base` to `/<repo-name>/` automatically so assets resolve
correctly on the project page URL. To run a production build locally with a custom
base:

```bash
VITE_BASE=/govmap-demo/ npm run build
```
