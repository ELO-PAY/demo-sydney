// Plan-protocol engine tests. Uses node:test + node:assert — both builtins —
// so a client project can verify the protocol with plain `node --test` and no
// test framework, package.json or install of any kind.
//
//   node --test .specify/extensions/plan-protocol/
//
// Ported from 037's vitest suite (tests/unit/plans/plan-protocol.spec.ts), which
// this replaces: one engine, one home for its tests.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_CONFIG,
  checkCoverage,
  daysSince,
  detectHotZones,
  findConflicts,
  metaFromFields,
  parseFlatYaml,
  pathWithin,
  planForBranch,
  render,
  touchesOverlap,
} from './plan.mjs'

const config = {
  ...DEFAULT_CONFIG,
  hotZones: [
    'website/src/components',
    'website/package.json',
    'website/supabase/migrations',
    '.specify/extensions',
  ],
}

const meta = (over = {}) => ({
  slug: 'x',
  title: 'X',
  component: 'platform',
  status: 'in-progress',
  updated: '2026-07-30',
  owner: 'someone/claude-code',
  branch: 'feat/x',
  touches: [],
  ...over,
})

describe('parseFlatYaml', () => {
  test('parses scalars, inline arrays, and dash lists', () => {
    const out = parseFlatYaml(
      'slug: a-b\ntouches: [x, y/z]\nextras:\n- one\n- two\n# comment\nnote: hi there',
      'f'
    )
    assert.equal(out.slug, 'a-b')
    assert.deepEqual(out.touches, ['x', 'y/z'])
    assert.deepEqual(out.extras, ['one', 'two'])
    assert.equal(out.note, 'hi there')
  })

  test('rejects a dash item with no preceding key', () => {
    assert.throws(() => parseFlatYaml('- stray', 'f'), /no preceding/)
  })

  test('rejects a non key-value line', () => {
    assert.throws(() => parseFlatYaml('just words', 'f'), /expected "key: value"/)
  })
})

describe('metaFromFields validation', () => {
  const base = { slug: 'd', title: 'T', component: 'learner', status: 'shipped', updated: '2026-07-30' }

  test('accepts a valid shipped meta', () => {
    assert.deepEqual(metaFromFields(base, 'd', 'f', config).errors, [])
  })

  test('requires slug to equal the dir name', () => {
    assert.match(metaFromFields(base, 'other', 'f', config).errors.join(), /must equal dir name/)
  })

  test('requires owner for active statuses and branch+touches once in-progress', () => {
    const errors = metaFromFields({ ...base, status: 'in-progress' }, 'd', 'f', config).errors.join('\n')
    assert.match(errors, /requires "owner"/)
    assert.match(errors, /requires "branch"/)
    assert.match(errors, /non-empty "touches"/)
  })

  test('normalizes trailing slashes in touches', () => {
    const { meta: m } = metaFromFields(
      { ...base, status: 'in-progress', owner: 'o', branch: 'b', touches: ['a/b/'] },
      'd',
      'f',
      config
    )
    assert.deepEqual(m.touches, ['a/b'])
  })

  // The engine ships no domain vocabulary of its own: by default any non-empty
  // component is valid, and a project opts into a fixed list via config.json.
  test('accepts any non-empty component when no taxonomy is configured', () => {
    assert.deepEqual(
      metaFromFields({ ...base, component: 'checkout' }, 'd', 'f', config).errors,
      []
    )
  })

  test('still requires a component to be present', () => {
    assert.match(
      metaFromFields({ ...base, component: '' }, 'd', 'f', config).errors.join(),
      /missing "component"/
    )
  })

  test('rejects an unknown component once a taxonomy IS configured', () => {
    const strict = { ...config, components: ['web', 'api', 'platform'] }
    assert.match(
      metaFromFields({ ...base, component: 'nope' }, 'd', 'f', strict).errors.join(),
      /"component" must be one of: web, api, platform/
    )
    assert.deepEqual(
      metaFromFields({ ...base, component: 'api' }, 'd', 'f', strict).errors,
      []
    )
  })
})

describe('path logic', () => {
  test('pathWithin matches exact and nested paths, not sibling prefixes', () => {
    assert.equal(pathWithin('a/b/c.ts', 'a/b'), true)
    assert.equal(pathWithin('a/b', 'a/b'), true)
    assert.equal(pathWithin('a/bc/d.ts', 'a/b'), false)
  })

  test('touchesOverlap is symmetric on nesting', () => {
    assert.equal(touchesOverlap('a/b', 'a/b/c'), true)
    assert.equal(touchesOverlap('a/b/c', 'a/b'), true)
    assert.equal(touchesOverlap('a/b', 'a/c'), false)
  })
})

describe('checkCoverage — the blast-radius cap', () => {
  test('exempts plan/doc paths, covers declared paths, flags the rest', () => {
    const c = checkCoverage(
      [
        '.specify/features/d/meta.yaml',
        'docs/qa/x.md',
        'website/src/lib/quiz/a.ts',
        'website/src/lib/plan/b.ts',
      ],
      ['website/src/lib/quiz'],
      config
    )
    assert.equal(c.exempt.length, 2)
    assert.deepEqual(c.covered, ['website/src/lib/quiz/a.ts'])
    assert.deepEqual(c.uncovered, ['website/src/lib/plan/b.ts'])
  })

  test('a broad parent touch does not grant a hot zone', () => {
    const c = checkCoverage(['website/src/components/Button.tsx'], ['website/src'], config)
    assert.deepEqual(c.hotZoneViolations, [
      {
        file: 'website/src/components/Button.tsx',
        zone: 'website/src/components',
        touch: 'website/src',
      },
    ])
  })

  test('a touch at least as specific as the zone does grant it', () => {
    assert.equal(
      checkCoverage(['website/src/components/Button.tsx'], ['website/src/components'], config).covered
        .length,
      1
    )
    assert.equal(
      checkCoverage(
        ['website/src/components/Button.tsx'],
        ['website/src/components/Button.tsx'],
        config
      ).covered.length,
      1
    )
  })

  test('package.json is a hot zone as a single file', () => {
    assert.equal(checkCoverage(['website/package.json'], ['website'], config).hotZoneViolations.length, 1)
    assert.equal(
      checkCoverage(['website/package.json'], ['website/package.json'], config).covered.length,
      1
    )
  })

  test('hot zones come from config, not the engine', () => {
    const noZones = { ...config, hotZones: [] }
    assert.equal(
      checkCoverage(['website/src/components/Button.tsx'], ['website/src'], noZones).covered.length,
      1
    )
  })

  // The engine enforces the protocol, so it must not be exempt from it: a
  // blanket `.specify` exemption made the one file that can switch enforcement
  // off the one file nobody had to declare.
  test('the engine is NOT exempt, and is a hot zone', () => {
    const c = checkCoverage(['.specify/extensions/plan-protocol/plan.mjs'], ['.specify'], config)
    assert.equal(c.exempt.length, 0)
    assert.equal(c.hotZoneViolations.length, 1)
    assert.equal(
      checkCoverage(
        ['.specify/extensions/plan-protocol/plan.mjs'],
        ['.specify/extensions/plan-protocol'],
        config
      ).covered.length,
      1
    )
  })

  test('plans and the generated registry stay exempt', () => {
    const c = checkCoverage(
      ['.specify/features/038-x/meta.yaml', '.specify/ACTIVE.md', 'docs/qa/x.md'],
      [],
      config
    )
    assert.equal(c.exempt.length, 3)
    assert.equal(c.uncovered.length, 0)
  })
})

describe('findConflicts', () => {
  const mine = meta({ slug: 'mine', touches: ['website/src/lib/quiz'], migration: '010' })

  test('reports touch overlaps with other active plans only', () => {
    const conflicts = findConflicts(
      mine,
      [
        meta({ slug: 'other', touches: ['website/src/lib/quiz/scoring'] }),
        meta({ slug: 'shipped-one', status: 'shipped', touches: ['website/src/lib/quiz'] }),
        meta({ slug: 'elsewhere', touches: ['website/src/lib/plan'] }),
      ],
      config
    )
    assert.deepEqual(
      conflicts.map((c) => c.slug),
      ['other']
    )
    assert.deepEqual(conflicts[0].overlaps[0], {
      mine: 'website/src/lib/quiz',
      theirs: 'website/src/lib/quiz/scoring',
    })
  })

  test('reports migration-number clashes even without touch overlap', () => {
    const conflicts = findConflicts(
      mine,
      [meta({ slug: 'db-work', touches: ['website/src/lib/billing'], migration: '010' })],
      config
    )
    assert.equal(conflicts[0].migrationClash, '010')
  })

  test('marks claims expired past the configured window', () => {
    // Fixed clock, so this cannot drift with the machine's timezone or date.
    const now = new Date('2026-07-30T12:00:00Z')
    const conflicts = findConflicts(
      mine,
      [meta({ slug: 'stale', touches: ['website/src/lib/quiz'], updated: '2026-07-10' })],
      config,
      now
    )
    assert.equal(conflicts[0].expired, true)
  })

  test('never conflicts with itself', () => {
    assert.deepEqual(findConflicts(mine, [mine], config), [])
  })
})

describe('planForBranch', () => {
  // Regression: AGENTS.md has the completing PR flip status to `shipped` in the
  // same commit. When the guard honoured ACTIVE plans only, that flip dropped
  // the lease and the finishing PR failed on every file it had declared.
  test('still resolves the lease once the plan is marked shipped', () => {
    const shipped = meta({ slug: 'done', status: 'shipped', branch: 'feat/x' })
    assert.equal(planForBranch([shipped], 'feat/x', config)?.slug, 'done')
  })

  test('prefers an active plan when two metas name the same branch', () => {
    const active = meta({ slug: 'live', status: 'in-progress', branch: 'feat/x' })
    const old = meta({ slug: 'old', status: 'superseded', branch: 'feat/x' })
    assert.equal(planForBranch([old, active], 'feat/x', config)?.slug, 'live')
  })

  test('returns undefined for a branch no plan claims', () => {
    assert.equal(planForBranch([meta({ branch: 'feat/x' })], 'feat/other', config), undefined)
  })
})

describe('daysSince', () => {
  test('computes whole days and tolerates garbage', () => {
    assert.equal(daysSince('2026-07-20', new Date('2026-07-30T12:00:00Z')), 10)
    assert.equal(daysSince('not-a-date'), 0)
  })
})

describe('detectHotZones — portability across stacks', () => {
  test('finds a Rails layout without any Node marker', () => {
    const tree = new Set(['db/migrate', 'Gemfile.lock', 'app/components'])
    const zones = detectHotZones('/repo', (p) => tree.has(p))
    assert.ok(zones.includes('db/migrate'))
    assert.ok(zones.includes('Gemfile.lock'))
    assert.ok(!zones.includes('package.json'))
  })

  test('finds a nested Next layout under website/', () => {
    const tree = new Set(['website/package.json', 'website/src/components', 'website/supabase/migrations'])
    const zones = detectHotZones('/repo', (p) => tree.has(p))
    assert.ok(zones.includes('website/package.json'))
    assert.ok(zones.includes('website/src/components'))
  })

  test('always includes the protocol’s own surfaces', () => {
    const zones = detectHotZones('/repo', () => false)
    for (const z of ['AGENTS.md', 'CLAUDE.md', '.claude', '.githooks']) assert.ok(zones.includes(z))
  })
})

describe('render', () => {
  test('separates active from archived and marks generated', () => {
    const out = render(
      [meta({ slug: 'a-live' }), meta({ slug: 'b-done', status: 'shipped', note: 'all good' })],
      config
    )
    assert.match(out, /GENERATED — do not edit/)
    const [activeHalf, archiveHalf] = out.split('## Archive')
    assert.match(activeHalf, /a-live/)
    assert.ok(!activeHalf.includes('b-done'))
    assert.match(archiveHalf, /b-done \| X \| platform \| shipped — all good/)
  })

  test('says so when nothing is active', () => {
    assert.match(render([meta({ status: 'shipped' })], config), /_No active plans registered\._/)
  })
})
