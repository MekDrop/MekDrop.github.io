const { execFileSync, spawnSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', '.quasar', 'tmp'])

/**
 * Run Git in the repository and return its standard output.
 * @param {string[]} args Git arguments.
 * @returns {string} Git standard output.
 */
function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

function getComparisonBase() {
  try {
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']).trim()
    return git(['merge-base', 'HEAD', upstream]).trim()
  } catch {
    for (const candidate of ['origin/HEAD', 'origin/main', 'origin/master', 'main', 'master']) {
      try {
        return git(['merge-base', 'HEAD', candidate]).trim()
      } catch {
        // Try the next conventional base.
      }
    }
    return null
  }
}

function listChangedPaths() {
  const base = getComparisonBase()
  const changed = new Set()

  if (base) {
    for (const file of git(['diff', '--name-only', '--diff-filter=ACMR', '-z', base, '--']).split('\0')) {
      if (file) changed.add(file)
    }
  } else {
    for (const file of git(['diff', '--name-only', '--diff-filter=ACMR', '-z', 'HEAD', '--']).split('\0')) {
      if (file) changed.add(file)
    }
    for (const file of git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0')) {
      if (file) changed.add(file)
    }
  }

  for (const file of git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0')) {
    if (file) changed.add(file)
  }

  return [...changed].filter((file) => {
    const parts = file.split(/[\\/]/)
    return !parts.some((part) => ignoredDirectories.has(part)) && /\.(?:js|vue)$/i.test(file)
  }).sort()
}

/**
 * Find a unique nearby unit test for a changed source or a changed unit test itself.
 * @param {string} file Repository-relative changed path.
 * @returns {string | null} Unit test path, or null when no single match exists.
 */
function relativeUnitTest(file) {
  const normalized = file.replaceAll('\\', '/')
  if (normalized.startsWith('test/unit/') && normalized.endsWith('.test.js')) {
    return normalized
  }

  if (!normalized.startsWith('src/')) {
    return null
  }

  const sourcePath = normalized.slice('src/'.length)
  const direct = `test/unit/${sourcePath.replace(/\.(?:js|vue)$/i, '.test.js')}`
  if (existsSync(path.join(root, direct))) {
    return direct
  }

  const base = path.basename(sourcePath).replace(/\.(?:js|vue)$/i, '').toLowerCase()
  let candidates
  try {
    candidates = git(['ls-files', 'test/unit']).split(/\r?\n/).filter(Boolean)
  } catch {
    candidates = []
  }

  const normalizedBase = base.replace(/[^a-z0-9]/g, '')
  const matches = candidates.filter((candidate) => {
    const testBase = path.basename(candidate).replace(/\.test\.js$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    return testBase === normalizedBase
  })

  if (matches.length === 1) {
    return matches[0]
  }

  return null
}

/**
 * Select a Cypress spec for source areas with an established E2E path.
 * @param {string} file Repository-relative changed path.
 * @returns {string | null} Cypress spec path, or null when no single match exists.
 */
function findCypressSpec(file) {
  const normalized = file.replaceAll('\\', '/')
  if (normalized.endsWith('.cy.js')) {
    return normalized
  }

  const shouldCheck = normalized.startsWith('src/game/') ||
    normalized === 'src/components/GameCanvas.vue' ||
    normalized.startsWith('src/pages/') ||
    normalized.startsWith('src/layouts/') ||
    normalized.startsWith('src/router/')

  if (!shouldCheck) {
    return null
  }

  const changedBase = path.basename(normalized).replace(/\.(?:js|vue)$/i, '').toLowerCase()
  let specs
  try {
    specs = git(['ls-files', 'test/cypress/e2e']).split(/\r?\n/).filter((item) => item.endsWith('.cy.js'))
  } catch {
    specs = []
  }

  const matching = specs.filter((spec) => {
    const specBase = path.basename(spec).replace(/\.cy\.js$/i, '').toLowerCase()
    return specBase === changedBase || spec.toLowerCase().includes(changedBase)
  })
  if (matching.length === 1) {
    return matching[0]
  }

  if (normalized.startsWith('src/pages/') || normalized.startsWith('src/router/') || normalized.startsWith('src/layouts/')) {
    const indexSpec = 'test/cypress/e2e/pages/IndexPage.cy.js'
    return existsSync(path.join(root, indexSpec)) ? indexSpec : null
  }

  if (normalized === 'src/components/GameCanvas.vue') {
    const movementSpec = 'test/cypress/e2e/game/objects/hero/HeroMovement.cy.js'
    return existsSync(path.join(root, movementSpec)) ? movementSpec : null
  }

  return null
}

/**
 * Run a local executable with inherited terminal output.
 * @param {string} command Executable path.
 * @param {string[]} args Executable arguments.
 * @returns {boolean} Whether the command succeeded.
 */
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  return result.status === 0
}

/**
 * Run npm through its current Node CLI when available, including on Windows paths with spaces.
 * @param {string[]} args npm arguments.
 * @returns {boolean} Whether npm succeeded.
 */
function runNpm(args) {
  const npmCli = process.env.npm_execpath
  if (npmCli && existsSync(npmCli)) {
    return run(process.execPath, [npmCli, ...args])
  }

  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return result.status === 0
}

async function isDevServerAccessible() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 1500)
  try {
    await fetch('http://localhost:9000', { signal: controller.signal, redirect: 'manual' })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  const files = listChangedPaths()
  if (files.length === 0) {
    console.log('check:changed: no changed JavaScript or Vue files found.')
    return
  }

  console.log(`Changed JS/Vue files (${files.length}):\n${files.map((file) => `  ${file}`).join('\n')}`)
  const eslint = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js')
  console.log('\nRunning focused lint...')
  if (!run(process.execPath, [eslint, ...files])) {
    process.exitCode = 1
    return
  }

  const unitTests = [...new Set(files.map(relativeUnitTest).filter(Boolean))]
  if (unitTests.length > 0) {
    console.log(`\nRunning nearest unit tests:\n${unitTests.map((file) => `  ${file}`).join('\n')}`)
    if (!run(process.execPath, ['--test', '--test-isolation=none', ...unitTests])) {
      process.exitCode = 1
      return
    }
  } else {
    console.log('\nNo unambiguous nearby unit tests found; skipping unit tests.')
  }

  const cypressSpecs = [...new Set(files.map(findCypressSpec).filter(Boolean))]
  if (cypressSpecs.length > 0) {
    console.log(`\nRunning targeted Cypress specs:\n${cypressSpecs.map((file) => `  ${file}`).join('\n')}`)
    if (!runNpm(['run', 'test:e2e:ci', '--', '--spec', cypressSpecs.join(',')])) {
      process.exitCode = 1
      return
    }
  } else {
    console.log('\nNo targeted Cypress spec applies; skipping E2E tests.')
  }

  const buildKind = files.some((file) => file.startsWith('src/i18n/') || file.startsWith('src/router/'))
    ? 'ssg'
    : files.some((file) => file === 'quasar.config.js' || file.startsWith('src/layouts/') || file.startsWith('src/pages/'))
      ? 'spa'
      : null

  if (buildKind) {
    if (await isDevServerAccessible()) {
      console.log(`\nBuild check (${buildKind}) skipped: http://localhost:9000 is already accessible.`)
    } else {
      console.log(`\nRunning build check: npm run build:${buildKind}`)
      if (!runNpm(['run', `build:${buildKind}`])) {
        process.exitCode = 1
        return
      }
    }
  } else {
    console.log('\nNo build-sensitive files changed; skipping build.')
  }

  console.log('\ncheck:changed completed successfully.')
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`check:changed failed: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = { findCypressSpec, getComparisonBase, listChangedPaths, relativeUnitTest }
