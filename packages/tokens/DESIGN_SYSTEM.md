# Portfolio Design System

Tokens live in `tokens.css`. Every app imports them via `@import "@portfolio/tokens/tokens.css"` and re-exposes them to Tailwind in its local `global.css` `@theme` block.

---

## Color palette — "Pacific Trail"

Nature-inspired. Warm cream base, forest greens, earth/walnut tones, and a terracotta clay accent.

### Neutral base

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.985 0.006 95)` | Page background — warm off-white |
| `--surface` | `oklch(1 0 0)` | Card / panel background |
| `--surface-2` | `oklch(0.945 0.009 95)` | Subtle inset backgrounds, tag fills |
| `--line` | `oklch(0.88 0.012 95)` | Borders, dividers |
| `--ink` | `oklch(0.28 0.013 95)` | Primary text |
| `--ink-soft` | `oklch(0.52 0.012 95)` | Secondary text, labels, captions |

### Green — Sage (forest)

| Token | Value | Use |
|---|---|---|
| `--sage` | `oklch(0.86 0.055 150)` | Light sage tint, backgrounds |
| `--sage-deep` | `oklch(0.62 0.085 150)` | Nav dot, current-role indicator, primary accents |

### Earth — Bark (walnut/driftwood)

| Token | Value | Use |
|---|---|---|
| `--bark` | `oklch(0.84 0.055 65)` | Sandy tan, driftwood — light earth tint |
| `--bark-deep` | `oklch(0.50 0.09 58)` | Walnut, dark soil — dates, section labels |

### Clay — Peach (terracotta)

| Token | Value | Use |
|---|---|---|
| `--peach` | `oklch(0.85 0.07 45)` | Terracotta/burnt clay — hero gradient start |
| `--peach-deep` | `oklch(0.62 0.11 42)` | Adobe/canyon red — deeper accent |

### Utility

| Token | Value | Use |
|---|---|---|
| `--warn-bg` | `oklch(0.92 0.05 25)` | Warning badge background |
| `--warn-text` | `oklch(0.45 0.11 25)` | Warning badge text |

---

## Elevation / shadows

Shadows use a warm bark-hued base so they feel grounded rather than cold-gray.

| Token | Value | Use |
|---|---|---|
| `--shadow` | `0 10px 30px -14px oklch(0.38 0.05 55 / 0.28)` | Resting card elevation |
| `--shadow-raised` | `0 18px 38px -16px oklch(0.38 0.05 55 / 0.42)` | Hover / lifted elevation |

---

## Shape scale

| Token | Value | Tailwind equivalent |
|---|---|---|
| `--r-sm` | `14px` | `rounded-[14px]` |
| `--r` | `20px` | `rounded-[20px]` |
| `--r-lg` | `28px` | `rounded-[28px]` |
| `--r-xl` | `40px` | `rounded-[40px]` |

---

## Typography

Three families — display for headings, sans for body, mono for labels and code.

| Token | Font | Use |
|---|---|---|
| `--font-display` | Fredoka | Section headings, nav brand, hero |
| `--font-sans` | DM Sans | Body copy, UI text |
| `--font-mono` | DM Mono | `// comment` labels, dates, tags, captions |

Loaded via Google Fonts in each app's `Base.astro`.

---

## Placeholder pattern (`.ph`)

Used site-wide for image slots before real photos are added.

```css
.ph {
  repeating-linear-gradient(45deg, surface-2 0 10px, surface 10px 20px)
  border: 1.5px dashed var(--line)
}
```

Each app has a `.ph` class in its `global.css`. The stripe is standardized to 10px across all apps.

---

## App-specific notes

| App | Domain | Background |
|---|---|---|
| `apps/dev` | juanr.dev | `bg-bg` (warm cream) |
| `apps/links` | juanr.links | `linear-gradient(165deg, driftwood → clay → sage)` |
| `apps/photos` | juanr.photo | Full-bleed hero images with dark scrim overlay |

---

## How to add a new color

1. Add the CSS variable to `packages/tokens/tokens.css`
2. Add the `--color-*` entry to the `@theme` block in **all three** `apps/*/src/styles/global.css` files
3. Use it as a Tailwind class: `text-bark-deep`, `bg-sage`, `border-peach-deep`, etc.
