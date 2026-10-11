import { describe, expect, it } from 'vitest'
import type { CaseStatus } from './case-status.ts'
import { CASE_WHATSAPP_STATUS_TEXT, caseWhatsappText } from './case-notify.ts'

describe('CASE_WHATSAPP_STATUS_TEXT (AVI-4)', () => {
  it('dice qué le pasa al trabajo en cada estado, en palabras de la clínica', () => {
    expect(CASE_WHATSAPP_STATUS_TEXT).toEqual({
      por_recoger: 'está registrado y pasaremos a recogerlo',
      nuevo: 'ya llegó al laboratorio',
      en_proceso: 'está en producción',
      en_espera: 'está en espera: necesitamos hablar con ustedes para continuar',
      en_prueba: 'va a su clínica para la prueba',
      terminado: 'está terminado y listo para entregar',
      enviado: 'va en camino a su clínica',
      entregado: 'fue entregado',
      cobrado: 'fue entregado',
      cancelado: 'fue cancelado',
    })
  })
})

describe('caseWhatsappText (AVI-4)', () => {
  it('saluda en nombre del laboratorio y dice código, paciente y estado', () => {
    expect(
      caseWhatsappText({
        labName: 'Arte Dental',
        code: '26-00087',
        patientRef: 'Ana Ruiz',
        status: 'terminado',
      }),
    ).toBe(
      'Hola, le escribimos de Arte Dental. El trabajo 26-00087 (paciente Ana Ruiz) está terminado y listo para entregar.',
    )
  })

  it('sin datos del laboratorio, «del laboratorio»', () => {
    expect(
      caseWhatsappText({
        labName: null,
        code: '26-00087',
        patientRef: 'Ana Ruiz',
        status: 'enviado',
      }),
    ).toBe(
      'Hola, le escribimos del laboratorio. El trabajo 26-00087 (paciente Ana Ruiz) va en camino a su clínica.',
    )
  })

  it('un nombre de laboratorio en blanco cuenta como sin datos', () => {
    expect(
      caseWhatsappText({ labName: '  ', code: '26-00001', patientRef: 'X', status: 'nuevo' }),
    ).toMatch(/^Hola, le escribimos del laboratorio\./)
  })

  it('nunca lleva un importe', () => {
    for (const status of Object.keys(CASE_WHATSAPP_STATUS_TEXT) as CaseStatus[]) {
      expect(
        caseWhatsappText({ labName: 'Arte Dental', code: '26-00001', patientRef: 'X', status }),
      ).not.toMatch(/\$|\d+\.\d{2}/)
    }
  })
})
