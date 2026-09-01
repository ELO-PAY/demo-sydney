#!/usr/bin/env node
// plan-protocol engine — the Plan Protocol (AGENTS.md) as one portable program.
//
// ZERO DEPENDENCIES, on purpose. `node:` builtins only: no tsx, no TypeScript
// build, no `npm install`, no package.json required anywhere in the project.
// Plain `node` exists on every machine already running Claude Code, Codex or
// Cursor; a devDependency in one subdirectory of one repo does not — that was
// what made v2 unportable to the other client projects.
//
// Nothing project-specific lives in here. Hot zones, exempt paths, where plans
// live, and how to run the gate are all read from config.json beside this file,
// because those differ between two Next apps, never mind a Rails one. Policy is
// data; this file is the engine.
//
// Usage (from anywhere inside the repo):
//   node .specify/extensions/plan-protocol/plan.mjs <verb>
//
//   index     regenerate the registry              check     validate + freshness (gate)
//   sync      SYNC: overlap/migration conflicts    guard     blast-radius cap (gate + hook)
//   submit    plan-only fast lane: push, PR, merge  premerge  merge base, then gate the result
//   init      install into this repo               doctor    diagnose + self-heal
//
// Pure logic is exported for plan.test.mjs (`node --test`).

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const ENGINE_VERSION = '2.0.0'

// ---------------------------------------------------------------------------
// repo + config
// ---------------------------------------------------------------------------

// Never __dirname-relative: the engine must not care how deep it is installed,
// which is exactly the assumption that pinned v2 to `website/scripts/`.
export function repoRoot(cwd = process.cwd()) {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export const DEFAULT_CONFIG = {
  protocolVersion: ENGINE_VERSION,
  plansDir: '.specify/features',
  registryFile: '.specify/ACTIVE.md',
  baseRef: 'origin/main',
  mainBranches: ['main', 'master'],
  // Paths whose changes never need plan coverage: plans, the generated
  // registry, and docs. Deliberately NOT all of `.specify/` — the engine lives
  // under there too, and exempting the thing that does the enforcing means the
  // most safety-critical file in the repo is the one nobody has to declare.
  exempt: ['.specify/features', '.specify/ACTIVE.md', '.specify/memory', '.specify/templates', 'docs'],
  // Shared surfaces where a silent change hurts everyone. A hot-zone change
  // needs a declared touch AT LEAST as specific as the zone.
  hotZones: [],
  trivialFixMaxFiles: 3,
  staleWarnDays: 7,
  claimExpiryDays: 14,
  // Empty = no taxonomy imposed: any non-empty `component` string is valid.
  // A project that wants a fixed vocabulary sets its own list in config.json and
  // the enum is enforced against that. The engine ships no domain words of its
  // own — it has to work for a Rails shop and a marketing site alike.
  components: [],
  statuses: ['planned', 'in-progress', 'blocked', 'shipped', 'superseded'],
  activeStatuses: ['planned', 'in-progress', 'blocked'],
  verifyCmd: null,
  verifyCwd: '.',
  projectName: null,
}

export const CONFIG_REL = '.specify/extensions/plan-protocol/config.json'

export function loadConfig(root) {
  const path = join(root, CONFIG_REL)
  if (!existsSync(path)) return { ...DEFAULT_CONFIG, _missing: true }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    fail(`${CONFIG_REL} is not valid JSON — ${e.message}`)
  }
  return { ...DEFAULT_CONFIG, ...parsed }
}

// ---------------------------------------------------------------------------
// flat-YAML meta parsing (no yaml dependency — meta.yaml stays this simple)
// ---------------------------------------------------------------------------

export function parseFlatYaml(raw, file) {
  const out = {}
  let listKey = null
  raw.split('\n').forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const dash = trimmed.match(/^-\s+(.*)$/)
    if (dash) {
      if (!listKey) throw new Error(`${file}:${i + 1} — list item with no preceding "key:" line`)
      out[listKey].push(dash[1].trim())
      return
    }
    const kv = trimmed.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!kv) throw new Error(`${file}:${i + 1} — expected "key: value", got "${trimmed}"`)
    const [, key, rawValue] = kv
    const value = rawValue.trim()
    if (value === '') {
      listKey = key
      out[key] = []
    } else if (value.startsWith('[') && value.endsWith(']')) {
      listKey = null
      out[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    } else {
      listKey = null
      out[key] = value.replace(/^["']|["']$/g, '')
    }
  })
  return out
}

export const normalizePath = (p) => p.replace(/\/+$/, '')

export function metaFromFields(fields, dir, rel, config = DEFAULT_CONFIG) {
  const errors = []
  const get = (k) => (typeof fields[k] === 'string' ? fields[k] : undefined)
  const meta = {
    slug: get('slug') ?? '',
    title: get('title') ?? '',
    component: get('component') ?? '',
    status: get('status') ?? '',
    updated: get('updated') ?? '',
    owner: get('owner'),
    branch: get('branch'),
    touches: Array.isArray(fields.touches) ? fields.touches.map(normalizePath) : undefined,
    migration: get('migration'),
    note: get('note'),
  }

  if (meta.slug !== dir) errors.push(`${rel} — slug "${meta.slug}" must equal dir name "${dir}"`)
  if (!meta.title) errors.push(`${rel} — missing "title"`)
  if (!meta.component) errors.push(`${rel} — missing "component"`)
  else if (config.components.length && !config.components.includes(meta.component))
    errors.push(`${rel} — "component" must be one of: ${config.components.join(', ')}`)
  if (!config.statuses.includes(meta.status))
    errors.push(`${rel} — "status" must be one of: ${config.statuses.join(', ')}`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.updated)) errors.push(`${rel} — "updated" must be YYYY-MM-DD`)
  if (config.activeStatuses.includes(meta.status) && !meta.owner)
    errors.push(`${rel} — active status "${meta.status}" requires "owner"`)
  if (['in-progress', 'blocked'].includes(meta.status)) {
    if (!meta.branch) errors.push(`${rel} — status "${meta.status}" requires "branch"`)
    if (!meta.touches?.length)
      errors.push(`${rel} — status "${meta.status}" requires a non-empty "touches" list`)
  }
  return { meta, errors }
}

export function loadMetasFromDir(root, config) {
  const featuresDir = join(root, config.plansDir)
  const errors = []
  const metas = []
  if (!existsSync(featuresDir)) return { metas, errors }
  for (const dir of readdirSync(featuresDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()) {
    const rel = `${config.plansDir}/${dir}/meta.yaml`
    const metaPath = join(featuresDir, dir, 'meta.yaml')
    if (!existsSync(metaPath)) {
      errors.push(`${rel} is missing — every feature dir needs one (contract in AGENTS.md)`)
      continue
    }
    try {
      const { meta, errors: e } = metaFromFields(
        parseFlatYaml(readFileSync(metaPath, 'utf8'), rel),
        dir,
        rel,
        config
      )
      errors.push(...e)
      metas.push(meta)
    } catch (e) {
      errors.push(String(e.message ?? e))
    }
  }
  return { metas, errors }
}

// Metas as they exist at a git ref — the only trustworthy view of other
// people's claims; a worktree copy is as old as its branch point.
export function loadMetasFromRef(root, ref, config) {
  const errors = []
  const metas = []
  let listing
  try {
    listing = git(root, ['ls-tree', '-r', '--name-only', ref, config.plansDir])
  } catch {
    return { metas, errors: [`could not read ${config.plansDir} at ${ref}`] }
  }
  for (const path of listing
    .split('\n')
    .filter((p) => p.endsWith('/meta.yaml'))
    .sort()) {
    const segments = path.split('/')
    const dir = segments[segments.length - 2]
    try {
      const { meta, errors: e } = metaFromFields(
        parseFlatYaml(git(root, ['show', `${ref}:${path}`]), `${ref}:${path}`),
        dir,
        `${ref}:${path}`,
        config
      )
      errors.push(...e)
      metas.push(meta)
    } catch (e) {
      errors.push(String(e.message ?? e))
    }
  }
  return { metas, errors }
}

// ---------------------------------------------------------------------------
// pure path logic
// ---------------------------------------------------------------------------

export const pathWithin = (file, prefix) => file === prefix || file.startsWith(prefix + '/')
export const coveringTouch = (file, touches) => touches.find((t) => pathWithin(file, t))
export const touchesOverlap = (a, b) => pathWithin(a, b) || pathWithin(b, a)

export function checkCoverage(changed, touches, config = DEFAULT_CONFIG) {
  const result = { exempt: [], covered: [], uncovered: [], hotZoneViolations: [] }
  for (const file of changed) {
    if (config.exempt.some((e) => pathWithin(file, e))) {
      result.exempt.push(file)
      continue
    }
    const touch = coveringTouch(file, touches)
    if (!touch) {
      result.uncovered.push(file)
      continue
    }
    const zone = config.hotZones.find((z) => pathWithin(file, z))
    // Both `touch` and `zone` are prefixes of the same file, so comparing
    // lengths compares depth: a shorter prefix is strictly broader.
    if (zone && touch.length < zone.length) {
      result.hotZoneViolations.push({ file, zone, touch })
      continue
    }
    result.covered.push(file)
  }
  return result
}

// Status-agnostic on purpose: AGENTS.md has the completing PR flip status to
// `shipped` in the same commit, so an ACTIVE-only lookup would reject the very
// PR that finishes the work. An active plan still wins on a tie.
export function planForBranch(metas, branch, config = DEFAULT_CONFIG) {
  const owned = metas.filter((m) => m.branch === branch)
  return owned.find((m) => config.activeStatuses.includes(m.status)) ?? owned[0]
}

export function daysSince(dateStr, now = new Date()) {
  const then = new Date(`${dateStr}T00:00:00Z`).getTime()
  if (Number.isNaN(then)) return 0
  return Math.floor((now.getTime() - then) / 86_400_000)
}

export function findConflicts(mine, others, config = DEFAULT_CONFIG, now = new Date()) {
  const conflicts = []
  for (const other of others) {
    if (other.slug === mine.slug || !config.activeStatuses.includes(other.status)) continue
    const overlaps = []
    for (const a of mine.touches ?? [])
      for (const b of other.touches ?? []) if (touchesOverlap(a, b)) overlaps.push({ mine: a, theirs: b })
    const migrationClash =
      mine.migration && other.migration === mine.migration ? mine.migration : undefined
    if (overlaps.length || migrationClash)
      conflicts.push({
        slug: other.slug,
        owner: other.owner,
        status: other.status,
        expired: daysSince(other.updated, now) > config.claimExpiryDays,
        overlaps,
        migrationClash,
      })
  }
  return conflicts
}

export function render(metas, config = DEFAULT_CONFIG) {
  const active = metas.filter((m) => config.activeStatuses.includes(m.status))
  const archive = metas.filter((m) => !config.activeStatuses.includes(m.status))
  const cell = (v) => (v ?? '—') || '—'
  const name = config.projectName ? `${config.projectName} · ` : ''
  const engine = `node ${CONFIG_REL.replace('config.json', 'plan.mjs')}`

  const lines = [
    `# ${name}Plan Registry`,
    '',
    `> **GENERATED — do not edit.** Regenerate with \`${engine} index\`.`,
    `> Source of truth: \`${config.plansDir}/<slug>/meta.yaml\`. Protocol: \`AGENTS.md\` (repo root).`,
    '>',
    '> Always read this file as it exists on the base ref, not from your worktree:',
    `> \`git fetch origin main --quiet && git show ${config.baseRef}:${config.registryFile}\``,
    '',
    '## Active',
    '',
  ]

  if (active.length === 0) {
    lines.push('_No active plans registered._', '')
  } else {
    lines.push(
      '| Slug | Title | Status | Owner | Component | Branch | Touches | Updated |',
      '|---|---|---|---|---|---|---|---|'
    )
    for (const m of active)
      lines.push(
        `| ${m.slug} | ${m.title} | ${m.status} | ${cell(m.owner)} | ${m.component} | ${cell(
          m.branch
        )} | ${m.touches?.length ? m.touches.map((t) => `\`${t}\``).join('<br>') : '—'} | ${m.updated} |`
      )
    lines.push('')
  }

  lines.push('## Archive (shipped / superseded)', '')
  lines.push('| Slug | Title | Component | Status | Updated |', '|---|---|---|---|---|')
  for (const m of archive)
    lines.push(
      `| ${m.slug} | ${m.title} | ${m.component} | ${m.note ? `${m.status} — ${m.note}` : m.status} | ${m.updated} |`
    )
  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// git + process helpers
// ---------------------------------------------------------------------------

export const git = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const gitQuiet = (root, args) => {
  try {
    return { ok: true, out: git(root, args) }
  } catch (e) {
    return { ok: false, out: String(e.stderr ?? e.message ?? e) }
  }
}

const say = (msg) => console.log(msg)
const warn = (msg) => console.warn(msg)
function fail(msg, extra = []) {
  console.error(`plan-protocol: ✗ ${msg}`)
  for (const line of extra) console.error(line)
  process.exit(1)
}

// Three-dot (merge-base), never two-dot: `git diff <base>` also lists files
// OTHER people changed on the base since we branched, so every branch would
// fail on foreign paths the moment anyone merged. Merge-base is also immune to
// a stale base ref, so this needs no fetch of its own.
export function changedFiles(root, baseRef) {
  const committed = git(root, ['diff', '--name-only', `${baseRef}...HEAD`])
  const working = git(root, ['diff', '--name-only', 'HEAD']) // staged + unstaged
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard'])
  return [...new Set([committed, working, untracked].flatMap((s) => s.split('\n')))]
    .filter(Boolean)
    .sort()
}

const currentBranch = (root) => git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])

function requireBaseRef(root, config) {
  const r = gitQuiet(root, ['rev-parse', '--verify', '--quiet', `${config.baseRef}^{commit}`])
  if (!r.ok) fail(`${config.baseRef} is missing from this clone — run \`git fetch origin main\` and rerun.`)
}

// ---------------------------------------------------------------------------
// verbs
// ---------------------------------------------------------------------------

function verbIndex(root, config, { check = false } = {}) {
  const { metas, errors } = loadMetasFromDir(root, config)
  if (errors.length)
    fail(
      `${errors.length} problem(s) in ${config.plansDir}:`,
      errors.map((e) => `  ✗ ${e}`)
    )
  const rendered = render(metas, config)
  const registryPath = join(root, config.registryFile)

  if (check) {
    const current = existsSync(registryPath) ? readFileSync(registryPath, 'utf8') : ''
    if (current !== rendered)
      fail(`${config.registryFile} is stale — run \`plan.mjs index\` and commit the result.`)
    say(`plan-protocol check: OK — ${metas.length} plans, registry up to date.`)
    return
  }
  mkdirSync(dirname(registryPath), { recursive: true })
  writeFileSync(registryPath, rendered)
  say(`plan-protocol index: wrote ${config.registryFile} (${metas.length} plans).`)
}

function verbGuard(root, config) {
  requireBaseRef(root, config)
  const branch = currentBranch(root)
  const changed = changedFiles(root, config.baseRef)

  if (config.mainBranches.includes(branch)) {
    if (changed.length === 0) return say(`plan-protocol guard: OK — on ${branch} with a clean tree.`)
    fail(`never work directly on ${branch} — branch first (AGENTS.md).`)
  }

  const { metas, errors } = loadMetasFromDir(root, config)
  if (errors.length) fail('invalid meta.yaml files — run `plan.mjs check` for details.')

  const mine = planForBranch(metas, branch, config)
  if (!mine) {
    const cov = checkCoverage(changed, [], config)
    const substantive = [...cov.uncovered, ...cov.hotZoneViolations.map((v) => v.file)]
    const hot = substantive.filter((f) => config.hotZones.some((z) => pathWithin(f, z)))
    if (substantive.length === 0)
      return say(`plan-protocol guard: OK — only exempt paths changed (${config.exempt.join(', ')}).`)
    if (substantive.length <= config.trivialFixMaxFiles && hot.length === 0)
      return say(
        `plan-protocol guard: OK — trivial-fix exemption (${substantive.length} file(s), no hot zones).`
      )
    fail(
      `branch "${branch}" has no registered plan and exceeds the trivial-fix exemption (${substantive.length} files${hot.length ? `, ${hot.length} in hot zones` : ''}).`,
      [
        '',
        `Register a plan first: ${config.plansDir}/<slug>/meta.yaml with branch + touches,`,
        'then `plan.mjs index` and `plan.mjs submit` (see AGENTS.md).',
      ]
    )
  }

  const cov = checkCoverage(changed, mine.touches ?? [], config)
  const problems = cov.uncovered.length + cov.hotZoneViolations.length
  if (problems === 0)
    return say(
      `plan-protocol guard: OK — all ${cov.covered.length + cov.exempt.length} changed file(s) within ${mine.slug}'s declared touches.`
    )

  fail(`${mine.slug} changes ${problems} path(s) outside its declared touches:`, [
    '',
    ...cov.uncovered.map((f) => `  ✗ ${f} — not covered by any touch`),
    ...cov.hotZoneViolations.map(
      (v) =>
        `  ✗ ${v.file} — hot zone "${v.zone}" needs an explicit touch at least that specific (yours: "${v.touch}")`
    ),
    '',
    `Either revert these files or widen the plan: edit ${config.plansDir}/${mine.slug}/meta.yaml`,
    '(touches) and run `plan.mjs index`. Scope changes are declared, never silent (AGENTS.md).',
  ])
}

function verbSync(root, config, argv) {
  if (!gitQuiet(root, ['fetch', 'origin', 'main', '--quiet']).ok)
    warn('plan-protocol sync: ⚠ could not fetch — using the last-fetched state.')

  const remote = loadMetasFromRef(root, config.baseRef, config)
  const local = loadMetasFromDir(root, config)
  // Local metas override remote per slug, so this branch's own unmerged plan
  // and status edits count.
  const bySlug = new Map()
  for (const m of remote.metas) bySlug.set(m.slug, m)
  for (const m of local.metas) bySlug.set(m.slug, m)
  const all = [...bySlug.values()]
  const active = all.filter((m) => config.activeStatuses.includes(m.status))

  for (const m of active) {
    const age = daysSince(m.updated)
    if (age > config.claimExpiryDays)
      warn(
        `plan-protocol sync: ⚠ ${m.slug} (${m.owner ?? 'unowned'}) is EXPIRED — no meta update in ${age} days; its claims no longer block others.`
      )
    else if (age > config.staleWarnDays)
      warn(
        `plan-protocol sync: ⚠ ${m.slug} (${m.owner ?? 'unowned'}) is stale — no meta update in ${age} days (claims expire at ${config.claimExpiryDays}).`
      )
  }

  const slugIdx = argv.indexOf('--slug')
  const slugArg = slugIdx > -1 ? argv[slugIdx + 1] : undefined
  const branch = currentBranch(root)
  const mine = slugArg ? bySlug.get(slugArg) : planForBranch(all, branch, config)

  if (!mine) {
    say(
      slugArg
        ? `plan-protocol sync: no plan with slug "${slugArg}".`
        : `plan-protocol sync: no active plan for branch "${branch}". Fine for a trivial fix (≤ ${config.trivialFixMaxFiles} files, no hot zones); anything larger needs a plan first.`
    )
    return say(`plan-protocol sync: ${active.length} active plan(s) total. Clear to proceed.`)
  }

  const conflicts = findConflicts(mine, active, config)
  const blocking = conflicts.filter((c) => !c.expired)
  for (const c of conflicts.filter((c) => c.expired))
    warn(
      `plan-protocol sync: ⚠ overlap with EXPIRED plan ${c.slug} (${c.owner ?? 'unowned'}) — not blocking, but check with the owner.`
    )

  if (blocking.length)
    fail(`${mine.slug} conflicts with ${blocking.length} active plan(s):`, [
      '',
      ...blocking.flatMap((c) => [
        ...c.overlaps.map(
          (o) =>
            `  ✗ ${c.slug} (${c.owner ?? 'unowned'}, ${c.status}) — your "${o.mine}" overlaps their "${o.theirs}"`
        ),
        ...(c.migrationClash
          ? [`  ✗ ${c.slug} (${c.owner ?? 'unowned'}) — both claim migration ${c.migrationClash}`]
          : []),
      ]),
      '',
      'Resolve before writing code: narrow your touches, talk to the owner, or sequence the work.',
    ])

  say(
    `plan-protocol sync: OK — ${mine.slug} has no conflicts with the other ${active.length - 1} active plan(s).`
  )
}

function runInherit(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: false })
  if (r.error) fail(`could not run ${cmd}: ${r.error.message}`)
  return r.status ?? 1
}

function verbSubmit(root, config) {
  const branch = currentBranch(root)
  if (config.mainBranches.includes(branch)) fail('run submit from a plan branch, not the base branch.')
  if (git(root, ['status', '--porcelain']))
    fail('uncommitted changes — commit the plan first (only plan paths).')

  gitQuiet(root, ['fetch', 'origin', 'main', '--quiet'])
  const changed = git(root, ['diff', '--name-only', `${config.baseRef}...HEAD`])
    .split('\n')
    .filter(Boolean)
  if (changed.length === 0) fail(`no committed changes vs ${config.baseRef}.`)

  // Exactly the plans and the generated registry — NOT the whole `.specify/`
  // tree. The engine lives there too, and this lane auto-merges without human
  // review; letting engine edits through it would auto-merge changes to the
  // enforcement itself.
  const laneAllows = [config.plansDir, config.registryFile]
  const outside = changed.filter((f) => !laneAllows.some((a) => pathWithin(f, a)))
  if (outside.length)
    fail(`the fast lane is for plan-only diffs (${laneAllows.join(', ')}). Outside that:`, [
      ...outside.map((f) => `  ✗ ${f}`),
      '',
      'Ship code through a normal PR with review — this lane skips it.',
    ])

  // Gate in-process — no npm, so this works in a repo with no package.json.
  verbIndex(root, config, { check: true })
  verbSync(root, config, [])

  const title = git(root, ['log', '-1', '--pretty=%s'])
  if (runInherit('git', ['push', '-u', 'origin', branch], root) !== 0) fail('push failed.')
  const body = `Plan-only PR via \`plan.mjs submit\` (AGENTS.md fast lane). Diff is \`${planRoot}/\`-only; check + sync passed.`
  if (
    runInherit('gh', ['pr', 'create', '--base', 'main', '--title', title, '--body', body], root) !== 0
  )
    fail('gh pr create failed — is the GitHub CLI installed and authenticated?')
  if (runInherit('gh', ['pr', 'merge', '--squash', '--delete-branch'], root) !== 0)
    fail('gh pr merge failed.')
  say('\nplan-protocol submit: plan merged — the registry is live for every agent.')
}

function verbPremerge(root, config) {
  const branch = currentBranch(root)
  if (config.mainBranches.includes(branch))
    fail('run premerge from the feature branch you intend to merge.')
  if (git(root, ['status', '--porcelain'])) fail('uncommitted changes — commit or stash first.')

  gitQuiet(root, ['fetch', 'origin', 'main', '--quiet'])
  requireBaseRef(root, config)
  const base = git(root, ['merge-base', 'HEAD', config.baseRef])
  const tip = git(root, ['rev-parse', config.baseRef])

  if (base === tip) {
    say(`plan-protocol premerge: branch already contains ${config.baseRef} — no merge needed.`)
  } else {
    say(`plan-protocol premerge: merging ${config.baseRef} (${tip.slice(0, 7)}) into ${branch}…`)
    if (runInherit('git', ['merge', '--no-edit', config.baseRef], root) !== 0)
      fail('merge conflict. Resolve it (or `git merge --abort`), then rerun.', [
        'Conflicts here are often semantic, not just textual — read both sides.',
      ])
  }

  // Plans that merged since you branched may now overlap you.
  verbSync(root, config, [])
  if (!config.verifyCmd)
    return say(
      'plan-protocol premerge: merged and SYNC clean. No verifyCmd configured — run this project\'s gate yourself.'
    )

  const [cmd, ...args] = config.verifyCmd.split(' ')
  const status = runInherit(cmd, args, resolve(root, config.verifyCwd))
  if (status !== 0) fail(`the gate failed on the merge result (\`${config.verifyCmd}\`).`)
  say(`\nplan-protocol premerge: OK — the gate passed on the merge result. ${branch} is safe to merge.`)
}

// ---------------------------------------------------------------------------
// init + doctor
// ---------------------------------------------------------------------------

// Propose hot zones by looking at the tree, so a Rails or Django repo gets a
// sensible cap without anyone hand-writing one.
export function detectHotZones(root, exists = (p) => existsSync(join(root, p))) {
  const candidates = [
    'supabase/migrations',
    'db/migrate',
    'prisma/migrations',
    'migrations',
    'src/lib/db',
    'src/components',
    'app/components',
    'components',
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'Gemfile.lock',
    'poetry.lock',
    'requirements.txt',
    'go.mod',
    'Cargo.toml',
    '.github/workflows',
  ]
  const found = []
  const prefixes = ['', 'website/', 'app/', 'src/', 'server/', 'api/', 'frontend/', 'backend/']
  for (const c of candidates)
    for (const p of prefixes) if (exists(p + c) && !found.includes(p + c)) found.push(p + c)
  // The protocol's own surfaces always belong in the cap — including the engine
  // itself, since editing it switches enforcement off for every runtime.
  return [...found, 'AGENTS.md', 'CLAUDE.md', '.claude', '.githooks', '.specify/extensions']
}

const HOOK = `#!/bin/sh
# Plan-protocol guard. Lives in git itself so it fires for EVERY agent runtime
# — Claude Code, Codex, Cursor, Windsurf — not just the ones that read
# CLAUDE.md. Activated per clone via core.hooksPath=.githooks (set by
# \`plan.mjs init\`/\`doctor\`). Never bypass with --no-verify.

branch=$(git rev-parse --abbrev-ref HEAD)
case "$branch" in
  main|master)
    echo "pre-push: ✗ direct push to $branch is forbidden — all changes go through a PR (AGENTS.md)."
    exit 1
    ;;
esac

root=$(git rev-parse --show-toplevel)
engine="$root/${CONFIG_REL.replace('config.json', 'plan.mjs')}"
if [ -f "$engine" ]; then
  node "$engine" guard || exit 1
else
  echo "pre-push: ⚠ plan-protocol engine missing — run the plan-protocol skill (init)."
fi
`

// Local calendar date, not toISOString(): UTC rolls over ~10h before Sydney
// does, so an ISO slice writes yesterday's date for most of the local workday.
function today(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

// The installation is itself a change to hot zones (the engine, the hook), so
// without a plan the first guard run after `init` fails on the protocol's own
// files. Registering a plan for it makes the install self-consistent from the
// first command — and leaves a worked meta.yaml in the repo as the example.
export function bootstrapPlan(config, { branch, onMain, owner, date }) {
  const component = !config.components.length
    ? 'platform'
    : config.components.includes('platform')
      ? 'platform'
      : config.components[0]
  const lines = [
    'slug: 000-plan-protocol',
    'title: Plan protocol installation',
    `component: ${component}`,
    `status: ${onMain ? 'planned' : 'in-progress'}`,
    `owner: ${owner}`,
    ...(onMain ? [] : [`branch: ${branch}`]),
    'touches: [.specify/extensions/plan-protocol, .githooks, AGENTS.md, CLAUDE.md]',
    `updated: ${date}`,
    'note: installed by the plan-protocol skill — set owner to <person>/<runtime>',
  ]
  return lines.join('\n') + '\n'
}

function verbInit(root, config) {
  const configPath = join(root, CONFIG_REL)
  const isNew = !existsSync(configPath)

  if (isNew) {
    const hasPkg = existsSync(join(root, 'package.json'))
    const hasWebsitePkg = existsSync(join(root, 'website', 'package.json'))
    const written = {
      protocolVersion: ENGINE_VERSION,
      projectName: null,
      plansDir: DEFAULT_CONFIG.plansDir,
      registryFile: DEFAULT_CONFIG.registryFile,
      baseRef: DEFAULT_CONFIG.baseRef,
      exempt: DEFAULT_CONFIG.exempt,
      hotZones: detectHotZones(root),
      // Written explicitly so the knob is discoverable. [] = any component
      // string is accepted; fill it in to enforce a fixed vocabulary.
      components: DEFAULT_CONFIG.components,
      trivialFixMaxFiles: DEFAULT_CONFIG.trivialFixMaxFiles,
      verifyCmd: hasPkg || hasWebsitePkg ? 'npm run verify' : null,
      verifyCwd: hasWebsitePkg && !hasPkg ? 'website' : '.',
    }
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, JSON.stringify(written, null, 2) + '\n')
    say(`plan-protocol init: wrote ${CONFIG_REL}`)
    say(`  hot zones detected: ${written.hotZones.length} — review them, they are the blast-radius cap.`)
    config = { ...DEFAULT_CONFIG, ...written }
  } else {
    say(`plan-protocol init: ${CONFIG_REL} already exists — keeping it.`)
  }

  const hookPath = join(root, '.githooks', 'pre-push')
  if (!existsSync(hookPath)) {
    mkdirSync(dirname(hookPath), { recursive: true })
    writeFileSync(hookPath, HOOK, { mode: 0o755 })
    say('plan-protocol init: wrote .githooks/pre-push (mode 755)')
  }

  const plansPath = join(root, config.plansDir)
  if (!existsSync(plansPath)) {
    mkdirSync(plansPath, { recursive: true })
    say(`plan-protocol init: created ${config.plansDir}/`)
  }

  // Self-register the install, so `guard` is green from the first run.
  const branch = currentBranch(root)
  const onMain = config.mainBranches.includes(branch)
  const { metas } = loadMetasFromDir(root, config)
  if (!planForBranch(metas, branch, config)) {
    const dir = join(plansPath, '000-plan-protocol')
    if (!existsSync(dir)) {
      const owner = gitQuiet(root, ['config', 'user.name'])
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        join(dir, 'meta.yaml'),
        bootstrapPlan(config, {
          branch,
          onMain,
          owner: `${(owner.ok && owner.out) || 'unassigned'}/agent`,
          date: today(),
        })
      )
      say(`plan-protocol init: registered ${config.plansDir}/000-plan-protocol for this install`)
      if (onMain)
        warn(
          `plan-protocol init: ⚠ you are on ${branch}. Branch, then set the plan's status to in-progress and add \`branch:\` — the protocol forbids working on ${branch}.`
        )
    }
  }
  verbIndex(root, { ...config, _missing: false })

  verbDoctor(root, config, { heal: true })
  say('\nplan-protocol init: done. Commit .githooks/, the engine, and the config so teammates inherit them.')
}

function verbDoctor(root, config, { heal = false } = {}) {
  const problems = []
  const fixed = []

  if (config._missing) problems.push(`${CONFIG_REL} is missing — run \`plan.mjs init\`.`)

  const hooksPath = gitQuiet(root, ['config', 'core.hooksPath'])
  if (!hooksPath.ok || hooksPath.out !== '.githooks') {
    if (heal) {
      git(root, ['config', 'core.hooksPath', '.githooks'])
      fixed.push('set core.hooksPath=.githooks (hooks are per-clone config, so every clone needs this)')
    } else {
      problems.push('core.hooksPath is not .githooks — enforcement is OFF for this clone. `doctor --heal`')
    }
  }

  const hookPath = join(root, '.githooks', 'pre-push')
  if (!existsSync(hookPath)) {
    problems.push('.githooks/pre-push is missing — run `plan.mjs init`.')
  } else if (!(statSync(hookPath).mode & 0o111)) {
    // Git SILENTLY ignores a non-executable hook, so this looks like working
    // enforcement while doing nothing at all.
    if (heal) {
      execFileSync('chmod', ['+x', hookPath])
      fixed.push('made .githooks/pre-push executable (git silently ignores non-executable hooks)')
    } else {
      problems.push('.githooks/pre-push is not executable — git ignores it silently. `doctor --heal`')
    }
  }

  if (config.protocolVersion !== ENGINE_VERSION)
    problems.push(
      `config protocolVersion ${config.protocolVersion} != engine ${ENGINE_VERSION} — run the plan-protocol skill (upgrade).`
    )

  if (!config.hotZones?.length)
    problems.push('no hotZones configured — the blast-radius cap has no teeth on shared surfaces.')

  const { errors } = loadMetasFromDir(root, config)
  if (errors.length) problems.push(`${errors.length} invalid meta.yaml file(s) — run \`plan.mjs check\`.`)

  const { metas } = loadMetasFromDir(root, config)
  for (const m of metas.filter((m) => config.activeStatuses.includes(m.status)))
    if (daysSince(m.updated) > config.claimExpiryDays)
      problems.push(
        `${m.slug} (${m.owner ?? 'unowned'}) EXPIRED — no update in ${daysSince(m.updated)} days.`
      )

  for (const f of fixed) say(`plan-protocol doctor: ✓ fixed — ${f}`)
  if (problems.length === 0) return say('plan-protocol doctor: OK — protocol installed and enforcing.')
  for (const p of problems) warn(`plan-protocol doctor: ⚠ ${p}`)
  if (!heal) process.exitCode = 1
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `plan-protocol ${ENGINE_VERSION} — the Plan Protocol as a program (AGENTS.md)

  node ${CONFIG_REL.replace('config.json', 'plan.mjs')} <verb>

  index     regenerate the registry from meta.yaml files
  check     validate metas + registry freshness   (gate step)
  sync      overlap + migration conflicts vs the base ref  [--slug <slug>]
  guard     blast-radius cap: changes must sit inside declared touches
  submit    plan-only fast lane: push, PR, merge
  premerge  merge the base ref, then run the gate on the RESULT
  init      install into this repo (config, hook, hooksPath)
  doctor    diagnose; --heal to repair what it can
`

export function main(argv = process.argv.slice(2)) {
  const verb = argv[0]
  if (!verb || ['-h', '--help', 'help'].includes(verb)) {
    say(USAGE)
    return
  }
  const root = repoRoot()
  const config = loadConfig(root)
  if (config._missing && !['init', 'doctor'].includes(verb))
    fail(`${CONFIG_REL} is missing — run \`plan.mjs init\` first.`)

  switch (verb) {
    case 'index':
      return verbIndex(root, config)
    case 'check':
      return verbIndex(root, config, { check: true })
    case 'sync':
      return verbSync(root, config, argv)
    case 'guard':
      return verbGuard(root, config)
    case 'submit':
      return verbSubmit(root, config)
    case 'premerge':
      return verbPremerge(root, config)
    case 'init':
      return verbInit(root, config)
    case 'doctor':
      return verbDoctor(root, config, { heal: argv.includes('--heal') })
    default:
      fail(`unknown verb "${verb}".`, ['', USAGE])
  }
}

// Run only when executed directly, so plan.test.mjs can import the pure logic.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
