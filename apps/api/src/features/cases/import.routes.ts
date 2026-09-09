import { parseCsv } from '@dentalware/shared'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { ctxFrom, requireRole } from '../auth/session.ts'
import type { AppEnv } from '../auth/session.ts'
import { buildTemplateCsv, headerMatches, MAX_IMPORT_BYTES } from './import.service.ts'
import type { ImportService } from './import.service.ts'

export const importRoutes = (service: ImportService) =>
  new Hono<AppEnv>()
    .use(requireRole('admin', 'recepcion'))
    .get('/plantilla', (c) => {
      c.header('Content-Type', 'text/csv; charset=utf-8')
      c.header('Content-Disposition', 'attachment; filename="plantilla-trabajos.csv"')
      return c.body(buildTemplateCsv())
    })
    .post(
      '/',
      bodyLimit({
        maxSize: MAX_IMPORT_BYTES + 1024,
        onError: (c) => c.json({ message: 'El archivo supera los 2 MB' }, 413),
      }),
      async (c) => {
        const commit = c.req.query('confirmar') === 'true'
        const body = await c.req.parseBody()
        const file = body['file']
        if (!(file instanceof File)) {
          return c.json(
            {
              message: 'Datos inválidos',
              issues: [{ path: 'file', message: 'Adjunta un archivo CSV' }],
            },
            422,
          )
        }
        if (file.size > MAX_IMPORT_BYTES) {
          return c.json({ message: 'El archivo supera los 2 MB' }, 413)
        }
        const text = await file.text()
        const rows = parseCsv(text)
        if (rows.length === 0 || !headerMatches(rows[0]!)) {
          return c.json(
            {
              message: 'Datos inválidos',
              issues: [{ path: 'cabecera', message: 'La cabecera no coincide con la plantilla' }],
            },
            422,
          )
        }
        const report = await service.run({ rows: rows.slice(1), commit }, ctxFrom(c))
        return c.json(report, 200)
      },
    )
