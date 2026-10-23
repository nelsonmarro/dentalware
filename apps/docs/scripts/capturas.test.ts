// @vitest-environment node
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

/** `capturas.sh` en modo rápido, sobre una copia en un directorio temporal (con su propio repo
 * git, `.auth/` y un `playwright` falso que escribe sus argumentos): nunca toca el `.auth/` real
 * ni arranca nada. El puerto 3000 tiene que estar ocupado: si nadie lo usa, lo ocupa el test. */
let dir: string
let docs: string
let puerto: Server | undefined

beforeAll(async () => {
  puerto = await new Promise<Server | undefined>((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(undefined)) // ya ocupado: vale igual
    server.listen(3000, '127.0.0.1', () => resolve(server))
  })
})

afterAll(async () => {
  await new Promise<void>((resolve) => (puerto ? puerto.close(() => resolve()) : resolve()))
})

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'capturas-sh-'))
  docs = join(dir, 'apps', 'docs')
  mkdirSync(join(docs, 'scripts'), { recursive: true })
  mkdirSync(join(docs, 'capturas', '.auth'), { recursive: true })
  mkdirSync(join(docs, 'node_modules', '.bin'), { recursive: true })
  copyFileSync(join(import.meta.dirname, 'capturas.sh'), join(docs, 'scripts', 'capturas.sh'))
  writeFileSync(join(docs, 'capturas', '.auth', 'demo-password'), 'x')
  const stub = join(docs, 'node_modules', '.bin', 'playwright')
  writeFileSync(stub, '#!/usr/bin/env bash\nprintf "%s\\n" "$@" >"$(dirname "$0")/args"\n')
  chmodSync(stub, 0o755)
  spawnSync('git', ['init', '-q', dir])
  return () => rmSync(dir, { recursive: true, force: true })
})

function correr(args: string[], apiPid: number) {
  writeFileSync(join(docs, 'capturas', '.auth', 'api.pid'), String(apiPid))
  return spawnSync('bash', [join(docs, 'scripts', 'capturas.sh'), ...args], {
    env: { ...process.env, CAPTURAS_RAPIDO: '1' },
    encoding: 'utf8',
  })
}

const argsDePlaywright = () =>
  readFileSync(join(docs, 'node_modules', '.bin', 'args'), 'utf8')
    .trim()
    .split('\n')

describe('capturas.sh', () => {
  it('quita el `--` que reenvía pnpm: el spec y el -g llegan a Playwright como filtro', () => {
    const r = correr(['--', 'primeros-pasos.spec.ts', '-g', 'entrar'], process.pid)
    expect(r.status, r.stderr).toBe(0)
    expect(argsDePlaywright()).toEqual([
      'test',
      '--config',
      'capturas/playwright.config.ts',
      '--tsconfig',
      'capturas/tsconfig.playwright.json',
      'primeros-pasos.spec.ts',
      '-g',
      'entrar',
    ])
  })

  it('sin `--`, los argumentos llegan igual', () => {
    const r = correr(['primeros-pasos.spec.ts'], process.pid)
    expect(r.status, r.stderr).toBe(0)
    expect(argsDePlaywright().slice(-1)).toEqual(['primeros-pasos.spec.ts'])
  })

  it('el modo rápido se para si la API de `capturas:servidores` ya no corre (su PID está muerto)', () => {
    // Mayor que cualquier `pid_max` de Linux (4194304): no hay proceso con ese PID.
    const r = correr(['primeros-pasos.spec.ts'], 999_999_999)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('pnpm --filter @dentalware/docs capturas:servidores')
    expect(() => argsDePlaywright()).toThrow()
  })
})
