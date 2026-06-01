# Portfolio Monorepo

Turborepo + Astro monorepo for three personal portfolio sites.

| Site | App | Domain |
|------|-----|--------|
| Coding portfolio | `@portfolio/dev` | juanr.dev |
| Photography portfolio | `@portfolio/photos` | juanr.photos |
| Links page | `@portfolio/links` | juanr.links |

---

## Local development

Install dependencies from the root:

```bash
npm install
```

Run all apps simultaneously:

```bash
turbo dev
```

Run a single app:

```bash
turbo dev --filter=@portfolio/dev
turbo dev --filter=@portfolio/photos
turbo dev --filter=@portfolio/links
```

Local ports:

| App | Port |
|-----|------|
| `@portfolio/dev` | http://localhost:4321 |
| `@portfolio/photos` | http://localhost:4322 |
| `@portfolio/links` | http://localhost:4323 |

---

## Building

Build all apps:

```bash
turbo build
```

Build a single app:

```bash
turbo build --filter=@portfolio/dev
```

Build output is written to `dist/` inside each app directory.

---

## Cloudflare Pages deployment

Each app is deployed as an independent Cloudflare Pages project.

### `@portfolio/dev` (juanr.dev)

| Setting | Value |
|---------|-------|
| Root directory | `apps/dev` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 18+ |

> **Note:** Run `npm install` from the repo root, not from `apps/dev`. Set the root directory in Cloudflare Pages to `apps/dev` and the install command to `cd ../.. && npm install` if Cloudflare runs install from the root directory, otherwise configure the monorepo build command as `cd ../.. && turbo build --filter=@portfolio/dev`.

### `@portfolio/photos` (juanr.photos)

| Setting | Value |
|---------|-------|
| Root directory | `apps/photos` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 18+ |

Photos (Lightroom JPEG exports) go in `apps/photos/public/photos/`. They are served as static assets at `/photos/<filename>`.

### `@portfolio/links` (juanr.links)

| Setting | Value |
|---------|-------|
| Root directory | `apps/links` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 18+ |

### Recommended Cloudflare Pages monorepo build command

Because this is a monorepo, set the **build command** to run Turborepo from the repo root and filter to the target app:

```
cd ../.. && npm ci && npx turbo build --filter=@portfolio/dev
```

Adjust the filter for each Pages project (`@portfolio/photos`, `@portfolio/links`).

---

## Shared tokens

Design tokens live in `packages/tokens/tokens.css`. All apps import this file via their `Base.astro` layout. Values are intentionally empty — they will be filled in from design docs.

```
@portfolio/tokens → packages/tokens/tokens.css
```
