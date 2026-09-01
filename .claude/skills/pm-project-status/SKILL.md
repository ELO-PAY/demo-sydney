---
name: pm-project-status
description: >-
  Builds and updates the project status dashboard — a single HTML page showing which features are planned, in progress, and shipped, plus a PDF companion regenerated on every update. Includes a build log, key metrics, and links to all important docs. The operator uses this to understand where the project stands at a glance.
  Use when the operator says "project status", "update the dashboard", or "where are we", and after any feature ships.
---

# PM: Project Status Dashboard

Maintain `docs/project-status.html`. Single HTML file, no external CSS/JS dependencies. If file exists, update it — never create from scratch.

## Sections (in order)

### 1. Hero
- Headline + prose sub (last updated date, current state in plain English, open bug count)
- 4 stat tiles: epics count, avg estimate %, open bugs, phases in flight

### 2. Epic Summary Table
One row per epic:
| # | Name | Pipeline (5 dots) | Estimate % | Depends on | Open bugs |

Pipeline uses 5 dots: Specified ●/○ → In flight ●/○ → Feature-complete ●/○ → Tested ●/○ → Shipped ●/○

### 3. Epic Detail Grid
2-column card grid. Each card:
- Epic number, title, thesis (one-liner)
- Status pill, % done bar
- Meta row: what's done / what's missing / success criterion / open bugs
- Deep-link to epic-status.md

### 4. Build Log
Recent commits to main, grouped by date, newest first. Omit PM/status-dashboard commits.

### 5. Companion Docs
Grid of links to all docs/product/ files.

### 6. Contributor Activity

A table of who moved the project in the current window. Everything here comes from
`git` and `gh` — there is no external script and no separate methodology document to
chase down.

```bash
# window totals per author
git log --no-merges --since=<start> --until=<end> --format='%an' | sort | uniq -c | sort -rn
# PRs merged in the window
gh pr list --base main --state merged --search "merged:<start>..<end>" --json author,title
```

| Contributor | Commits | PRs merged | First → last activity |
|---|---|---|---|

**Rules:**
- Count commits and merged PRs only. Do not publish time estimates, hour counts, or
  effort figures — nothing in this repo can measure them, and a fabricated number on a
  client-facing dashboard is worse than no number.
- One row per git author. Fold duplicate identities (same person, two emails) into one
  row and note the aliases beneath the table.
- Append a new window row beneath the cumulative total — never retroactively recompute
  a past row.
- If the operator wants effort or cost reporting, say it is out of scope for this
  dashboard rather than improvising a metric.

### 7. Pulse Chart

One combined inline SVG. X-axis = calendar date. Y-axis = **percent of each series' own
window peak (0–100 %)** — every series normalised independently so all share one Y-axis.
Max 6 colour-coded lines; past 6, split into two stacked charts.

```
y[series][day] = 100 × raw[series][day] / max(raw[series] over window)
```

| # | Metric | Colour | Line | Source |
|---|---|---|---|---|
| 1 | Commits to `main` (count/day) | `#F28C38` | solid | `git log --no-merges --format='%ad' --date=short` |
| 2 | PRs merged to `main` (count/day) | `#3F8A5C` | solid | `gh pr list --base main --state merged --search "merged:<start>..<end>"` |
| 3 | Files changed (count/day) | `#2F6F8F` | solid | `git log --no-merges --numstat` |
| 4 | Epics ≥ 95% complete (cumulative) | `#6B5B8E` | **dashed** (flat/structural) | `docs/product/epic-status.md` |
| 5 | Open bugs (count/day) | `#B9C3CB` | solid | `docs/qa/*-triage.md` dates + resolution status |

**Key rules:**
- Legend entry for every series: colour + peak value + unit + window total. No
  colour-only entries.
- Solid line = series moved in the window. Dashed = flat or structural (e.g. cumulative
  epic count).
- Circle at every data point; slightly larger circle on the peak day.
- Gridlines at 0 / 25 / 50 / 75 / 100 %, Y-axis labels in the gutter. No second Y-axis.
- X-axis: date + weekday (e.g. "28 May / Tue"). Max 5 days per chart.
- A series with no data in the window stays in the legend as muted/italic with "no
  activity" — removing it implies the metric isn't tracked.
- Add a **reading-guide paragraph** below the chart converting the most important
  percent back to absolute units (e.g. "Commits peaked at 14 on 5/29, a 3.5× increase
  over the 5/26 trough at 4").


## PDF Companion (generate every time)

Every time `docs/project-status.html` is created or updated, immediately regenerate `docs/project-status.pdf` next to it (same basename) as a single continuous page — not a print-paginated document.

1. Use headless Chromium via Playwright. If not installed, `npx playwright install chromium`. Write a throwaway Node script in a temp dir — never add Playwright to the project's `package.json`.
2. Load the HTML as a `file://` URL, viewport width 1280px. Wait for `networkidle` and `document.fonts.ready`.
3. Inject `html,body{height:auto!important;overflow:visible!important;}` to release any fixed-height/`overflow:hidden` shell so all content is visible and measurable.
4. Measure `document.documentElement.scrollHeight`.
5. Render exactly ONE page: `width: 1280px`, `height: <measured>px`, `printBackground: true`, zero margins — no pagination or sheet breaks.
6. Save as `docs/project-status.pdf`.
7. If the file exceeds ~10MB, warn the operator (GitHub won't render it inline above that) and offer a full-page PNG (`fullPage: true` screenshot) as a fallback instead.
8. Sanity-check the render — if the flatten broke the layout (overlapping/clipped/collapsed content), fall back to a tall fixed viewport height and note that in the commit.
9. Stage the PDF alongside the HTML so they never drift apart, but do not commit — the
   operator authorises commits (`.claude/rules/global-engineering.md`). Delete the temp
   script/dir when done.
   ```bash
   git add docs/project-status.html docs/project-status.pdf
   ```

## Theming
Use CSS variables:
```css
:root {
  --primary: #2563EB;
  --accent: #F97316;
  --bg: #0B1426;
  --surface: #1E293B;
  --text: #F1F5F9;
  --text-muted: #94A3B8;
  --success: #22C55E;
  --warning: #F59E0B;
  --danger: #EF4444;
}
```
Serif headlines, system sans-serif body, no inline styles.

## Design Note
Use the project default design system above. If the client defines their own design system in `docs/brand/style-guide.md`, update the CSS variables to match — but maintain the same section structure and layout.
