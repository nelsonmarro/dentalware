// @ts-check
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

// Fronteras hexagonales (ADR 21, docs/architecture.md §2 y §3.5): un servicio o puerto
// nunca importa un adaptador; entre features solo se comparten puertos (`ports.ts`,
// `*.ports.ts`) y errores de dominio (`errors.ts`); el repo puede unir tablas de otra
// feature (ADR 24) pero nunca su repo, rutas ni servicio.
const API = 'apps/api/src/features'

/** @param {string[]} files @param {import('typescript-eslint').TSESLint.FlatConfig.RuleEntry['0'][]} [extra] */
const noAdapters = (files, extra = []) => ({
  files,
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              'hono',
              'hono/*',
              'drizzle-orm',
              'drizzle-orm/*',
              '**/db/**',
              'better-auth',
              'better-auth/*',
              'sharp',
              'node:fs',
              'node:fs/*',
              'node:crypto',
            ],
            message:
              'Los servicios y puertos no dependen de adaptadores: declara un puerto e inyéctalo (docs/architecture.md §2).',
          },
          {
            group: [
              '../../lib/images.ts',
              '../../lib/storage.ts',
              '../../lib/ids.ts',
              '../../lib/clock.ts',
            ],
            allowTypeImports: true,
            message:
              'Del adaptador solo se importa su puerto (import type): la implementación se inyecta en createApp.',
          },
          {
            group: [
              './repo',
              './repo.ts',
              './routes',
              './routes.ts',
              './import.repo.ts',
              './import.routes.ts',
            ],
            message: 'Un servicio o puerto no importa su repo ni sus rutas.',
          },
          {
            group: [
              '../*/repo.ts',
              '../*/routes.ts',
              '../*/service.ts',
              '../*/import.repo.ts',
              '../*/import.routes.ts',
              '../*/import.service.ts',
              '**/features/*/repo.ts',
              '**/features/*/routes.ts',
              '**/features/*/service.ts',
            ],
            message:
              'Entre features solo se comparten puertos (ports.ts) y errores (errors.ts); la inyección va en createApp.',
          },
          ...extra,
        ],
      },
    ],
  },
})

// Restricciones de imports en apps/web fuera de features/auth y del cliente HTTP
// (docs/architecture.md §3.3): Better Auth es un adaptador confinado a features/auth,
// y de la API tipada solo se importan tipos.
const webAdapterPatterns = [
  {
    group: ['better-auth', 'better-auth/*', '@/features/auth/auth-client'],
    message: 'Better Auth solo dentro de features/auth (usa getSession/useSession).',
  },
  {
    group: ['@dentalware/api', '@dentalware/api/*'],
    allowTypeImports: true,
    message: 'De la API solo se importan tipos (hc<AppType> vive en src/lib/api.ts).',
  },
]

// Fronteras del DataGrid (docs/architecture.md §3.5, spec 2026-09-12 §2.1): es transversal
// (components/), así que no depende de una feature de la app, de una ruta ni del cliente HTTP;
// su núcleo (use-data-grid.ts, data-grid.tsx, context.ts, define-columns.ts, types.ts, parts/*)
// no conoce ninguna `features/*` propia del DataGrid, y cada módulo de `features/*` no importa
// el núcleo ni a otro módulo hermano: solo el contrato de types.ts, el contexto y sus propios
// sub-archivos (p. ej. filtering-column-filter.tsx). El único puente es index.ts, el barrel que
// re-exporta las factorías de features a propósito: queda fuera de la restricción del núcleo.
const DATA_GRID = 'apps/web/src/components/data-grid'
const dataGridAppBoundary = {
  group: ['@/features/*', '@/features/**', '@/routes/*', '@/routes/**', '@/lib/api'],
  message:
    'DataGrid es transversal (components/): no depende de una feature de la app, de una ruta ni de @/lib/api.',
}

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/routeTree.gen.ts',
    'apps/api/drizzle/**',
    'apps/web/dev-dist/**',
    '.remember/**',
  ]),
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },

  // --- apps/api: servicios y puertos, sin adaptadores (ADR 17-20) ---
  noAdapters(
    [`${API}/*/service.ts`, `${API}/*/*.service.ts`, `${API}/*/errors.ts`],
    [
      {
        group: ['./schema', './schema.ts', '../*/schema.ts'],
        message: 'El servicio no conoce las tablas: usa el repo a través de su puerto.',
      },
    ],
  ),
  noAdapters(
    [`${API}/*/ports.ts`, `${API}/*/*.ports.ts`],
    [
      {
        group: ['./schema', './schema.ts'],
        allowTypeImports: true,
        message: 'ports.ts solo deriva tipos del schema propio (import type).',
      },
      {
        group: ['../*/schema.ts'],
        message:
          'ports.ts no depende del schema de otra feature: declara su propio tipo o consume el puerto de esa feature.',
      },
    ],
  ),
  {
    // #54 boy-scout: users y products se migran en la Iteración 5 (routes.ts con
    // Drizzle/reglas propias todavía); el resto de rutas ya solo valida y traduce.
    files: [`${API}/*/routes.ts`, `${API}/*/*.routes.ts`],
    ignores: [`${API}/users/routes.ts`, `${API}/products/routes.ts`],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'drizzle-orm',
                'drizzle-orm/*',
                '**/db/schema/**',
                './schema.ts',
                '../*/schema.ts',
                '../*/repo.ts',
              ],
              message: 'La ruta solo valida, autoriza y traduce: los datos llegan por el servicio.',
            },
            {
              group: ['**/db/**'],
              allowTypeImports: true,
              message: 'La ruta no toca la base de datos: solo el tipo Db para su factoría.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [`${API}/*/repo.ts`, `${API}/*/*.repo.ts`],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['hono', 'hono/*', '../*/repo.ts', '../*/routes.ts', '../*/service.ts'],
              message:
                'El repo puede unir tablas de otra feature (schema.ts) pero no usar su repo, rutas ni servicio.',
            },
          ],
        },
      ],
    },
  },

  // --- apps/web: la red solo se toca en features/<f>/api.ts (ADR 17, §3.3) ---
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: [
      'apps/web/src/**/api.ts',
      // Sube con `fetch` directo porque `hc` no tipa `form`: ver el comentario en el archivo.
      'apps/web/src/features/cases/attachments-api.ts',
      'apps/web/src/test/**',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'La red solo se toca en features/<f>/api.ts.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'fetch',
          message: 'La red solo se toca en features/<f>/api.ts.',
        },
        {
          object: 'globalThis',
          property: 'fetch',
          message: 'La red solo se toca en features/<f>/api.ts.',
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/lib/api.ts', 'apps/web/src/features/auth/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'hono/client', message: 'hc solo en src/lib/api.ts.' }],
          patterns: webAdapterPatterns,
        },
      ],
    },
  },
  {
    // Más específico que el bloque anterior: incluye sus mismas restricciones (el
    // último `no-restricted-imports` que matchea un archivo reemplaza, no fusiona, al
    // anterior) más la propia de rutas.
    files: ['apps/web/src/routes/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'hono/client', message: 'hc solo en src/lib/api.ts.' }],
          patterns: [
            ...webAdapterPatterns,
            {
              group: ['@/lib/api', '@/features/*/api', '@/features/*/api.ts'],
              allowTypeImports: true,
              message:
                'Las rutas solo importan de features/ (hooks y componentes) y components/; de api.ts solo tipos.',
            },
          ],
        },
      ],
    },
  },

  // --- components/data-grid: aislamiento núcleo/features (docs/architecture.md §3.5) ---
  // Bloque general primero (menos específico): cualquier archivo de data-grid, index.ts y los
  // tests incluidos, no depende de una feature de la app, de una ruta ni de @/lib/api. Los dos
  // bloques siguientes son más específicos y repiten esta restricción junto a la propia (el
  // último `no-restricted-imports` que matchea un archivo reemplaza, no fusiona, al anterior).
  {
    files: [`${DATA_GRID}/**`],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [dataGridAppBoundary] }],
    },
  },
  {
    // Núcleo: no importa ninguna feature propia del DataGrid. index.ts queda fuera a propósito
    // (re-exporta las factorías, ver el comentario de `dataGridAppBoundary`); los tests de
    // parts/* (si los hay) también, porque montan features reales para probar comportamiento.
    files: [
      `${DATA_GRID}/use-data-grid.ts`,
      `${DATA_GRID}/data-grid.tsx`,
      `${DATA_GRID}/context.ts`,
      `${DATA_GRID}/define-columns.ts`,
      `${DATA_GRID}/types.ts`,
      `${DATA_GRID}/parts/**`,
    ],
    ignores: [`${DATA_GRID}/parts/**/*.test.{ts,tsx}`],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            dataGridAppBoundary,
            {
              group: ['./features/*', '../features/*', '**/data-grid/features/*'],
              message:
                'El núcleo del DataGrid no importa features: solo conoce el contrato GridFeature y el contexto (docs/architecture.md §3.5).',
            },
          ],
        },
      ],
    },
  },
  {
    // Una feature no importa el núcleo ni a otra feature hermana: cada módulo trae completas
    // las features de TanStack que necesita (spec §3). Sus propios sub-archivos (p. ej.
    // filtering-column-filter.tsx) sí se pueden importar; sus tests quedan fuera porque montan
    // el núcleo real (DataGrid.Root, useDataGrid) para probar comportamiento.
    files: [`${DATA_GRID}/features/*.{ts,tsx}`],
    ignores: [`${DATA_GRID}/features/*.test.{ts,tsx}`],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            dataGridAppBoundary,
            {
              group: [
                '../use-data-grid',
                '../use-data-grid.ts',
                '../data-grid',
                '../data-grid.tsx',
                './sorting',
                './sorting.tsx',
                './pagination',
                './pagination.tsx',
                './filtering',
                './filtering.tsx',
                './resizing',
                './resizing.ts',
                './resizing.tsx',
                './grouping',
                './grouping.ts',
                './grouping.tsx',
                './advanced-filter',
                './advanced-filter.ts',
                './advanced-filter.tsx',
                './pinning',
                './pinning.ts',
                './pinning.tsx',
                './url-state',
                './url-state.ts',
                '**/data-grid/features/*',
              ],
              message:
                'Una feature del DataGrid no importa el núcleo ni otra feature (spec §3): solo sus propios sub-archivos, types.ts y context.ts.',
            },
          ],
        },
      ],
    },
  },

  eslintConfigPrettier,
])
