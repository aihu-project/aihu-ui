#!/usr/bin/env bun

/**
 * Verify the public `@aihu/ui/registry` type export from the actual npm
 * payload. This catches a package that passes source typechecking while its
 * `files`/`exports` configuration omits the contract consumers import.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const temp = mkdtempSync(join(tmpdir(), 'aihu-ui-contract-'))
const packDir = join(temp, 'pack')
const fixture = join(temp, 'fixture')
mkdirSync(packDir)
mkdirSync(join(fixture, 'node_modules', '@aihu', 'ui'), { recursive: true })

try {
  const packOutput = execFileSync(
    'bun',
    ['pm', 'pack', '--ignore-scripts', '--destination', packDir],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  )
  const tarball = packOutput
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.endsWith('.tgz'))
  if (!tarball) throw new Error(`bun pm pack did not report a tarball:\n${packOutput}`)
  const tarballPath = tarball.startsWith('/') ? tarball : join(packDir, tarball)

  execFileSync('tar', [
    '-xzf',
    tarballPath,
    '-C',
    join(fixture, 'node_modules', '@aihu', 'ui'),
    '--strip-components=1',
  ])
  const packageJson = JSON.parse(
    readFileSync(join(fixture, 'node_modules', '@aihu', 'ui', 'package.json'), 'utf8'),
  ) as { exports?: Record<string, unknown> }
  if (!existsSync(join(fixture, 'node_modules', '@aihu', 'ui', 'src', 'registry.ts'))) {
    throw new Error('packed payload is missing src/registry.ts')
  }
  if (!packageJson.exports || !Object.hasOwn(packageJson.exports, './registry')) {
    throw new Error('packed package is missing the ./registry export')
  }

  writeFileSync(
    join(fixture, 'package.json'),
    JSON.stringify({ name: 'aihu-ui-contract-fixture', private: true, type: 'module' }, null, 2),
  )
  writeFileSync(
    join(fixture, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ['consumer.ts'],
      },
      null,
      2,
    ),
  )
  writeFileSync(
    join(fixture, 'consumer.ts'),
    "import type { Registry, RegistryItem } from '@aihu/ui/registry'\nconst item: RegistryItem = { name: 'button', type: 'ui', files: [] }\nconst catalog: Registry = { items: [item] }\nvoid catalog\n",
  )

  const tsc = resolve(ROOT, 'node_modules/.bin/tsc')
  execFileSync(tsc, ['--noEmit', '-p', join(fixture, 'tsconfig.json')], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  console.log('OK: packed @aihu/ui/registry contract is present and consumable')
} finally {
  rmSync(temp, { recursive: true, force: true })
}
