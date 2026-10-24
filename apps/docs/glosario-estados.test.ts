import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CASE_STATUS_LABEL } from '@dentalware/shared'
import { describe, expect, it } from 'vitest'

const glosario = readFileSync(join(import.meta.dirname, 'docs/referencia/glosario.md'), 'utf8')

/** Términos que el glosario no puede perder, escritos tal cual (no se derivan de shared). */
const TERMINOS = [
  'Trabajo',
  'Código del trabajo',
  'Clínica',
  'Doctor',
  'Referencia del paciente',
  'Pieza y notación FDI',
  'Odontograma',
  'Línea',
  'Producto',
  'Categoría',
  'Precio por clínica',
  'Fase',
  'Técnico responsable',
  'Estado',
  'Fecha de ingreso',
  'Fecha deseada',
  'Fecha comprometida',
  'Días hábiles',
  'Prueba en boca',
  'En espera',
  'En camino al laboratorio',
  'Repetición',
  'Recogida',
  'Entrega',
  'Constancia de entrega',
  'Mensajero',
  'Cuenta de la clínica',
  'Saldo',
  'Saldo a favor',
  'Antigüedad',
  'Pago',
  'Aplicado',
  'Ajuste',
  'Saldo inicial',
  'Estado de cuenta',
  'Orden de trabajo',
  'Código QR',
  'Notas internas',
  'Lista de verificación',
  'Importar CSV',
  'Rol',
  'Administración',
  'Dentalware instalada',
]

const entradas = [...glosario.matchAll(/^- \*\*(.+?):\*\* /gm)].map((m) => m[1]!)

describe('glosario del manual', () => {
  it('tiene una entrada por cada estado, con el rótulo de la app', () => {
    const rotulos = Object.values(CASE_STATUS_LABEL)
    expect(rotulos).toHaveLength(10)
    for (const rotulo of rotulos) {
      expect(entradas, `falta el estado «${rotulo}»`).toContain(rotulo)
    }
  })

  it('tiene una entrada por cada término obligatorio', () => {
    for (const termino of TERMINOS) {
      expect(entradas, `falta el término «${termino}»`).toContain(termino)
    }
  })

  it('cada entrada lleva al menos un enlace relativo a una guía', () => {
    const lineas = glosario.split('\n').filter((l) => /^- \*\*.+?:\*\* /.test(l))
    expect(lineas.length).toBeGreaterThan(0)
    for (const linea of lineas) {
      expect(linea, linea.slice(0, 40)).toMatch(/\]\((\.\/|\.\.\/)[^)]*\.md/)
    }
  })

  it('va en orden alfabético', () => {
    const orden = [...entradas].sort((a, b) => a.localeCompare(b, 'es'))
    expect(entradas).toEqual(orden)
  })
})
