import { describe, expect, it } from 'vitest'
import type { Estados } from './estados'
import { textoMermaid } from './texto-mermaid'

/** Datos a medida, no los de shared: el constructor es puro y se prueba con lo que haga falta. */
const PEQUENA: Estados = {
  estados: [
    { clave: 'nuevo', rotulo: 'Nuevo "urgente"' },
    { clave: 'en_proceso', rotulo: 'En proceso' },
    { clave: 'cancelado', rotulo: 'Cancelado' },
  ],
  transiciones: [
    {
      accion: 'aceptar',
      rotulo: 'Aceptar "ya"',
      desde: ['nuevo'],
      hasta: 'en_proceso',
      roles: ['admin'],
    },
    {
      accion: 'cancelar',
      rotulo: 'Cancelar trabajo',
      desde: ['nuevo', 'en_proceso'],
      hasta: 'cancelado',
      roles: ['admin'],
    },
  ],
}

describe('textoMermaid', () => {
  it('pinta un nodo por estado y una flecha por cada origen de cada acción salvo cancelar', () => {
    expect(textoMermaid(PEQUENA)).toBe(
      [
        'flowchart TD',
        '  nuevo["Nuevo #quot;urgente#quot;"]',
        '  en_proceso["En proceso"]',
        '  cancelado["Cancelado"]',
        '  nuevo -->|"Aceptar #quot;ya#quot;"| en_proceso',
      ].join('\n'),
    )
  })

  it('una comilla en un rótulo no cierra la cadena de Mermaid', () => {
    const texto = textoMermaid(PEQUENA)
    for (const linea of texto.split('\n').slice(1)) {
      expect(linea.match(/"/g)?.length ?? 0, linea).toBe(2)
    }
  })
})
