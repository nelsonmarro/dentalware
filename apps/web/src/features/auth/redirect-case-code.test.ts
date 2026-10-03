import { describe, expect, it } from 'vitest'
import { redirectCaseCode } from './redirect-case-code'

// UX3-19: el login al que lleva el QR dice qué trabajo se abrirá tras entrar.
describe('redirectCaseCode', () => {
  it.each([
    ['/t/26-00001', '26-00001'],
    ['/t/25-12345', '25-12345'],
  ])('%s abre el trabajo %s', (redirect, code) => {
    expect(redirectCaseCode(redirect)).toBe(code)
  })

  it.each([
    [undefined],
    [''],
    ['/trabajos'],
    ['/t/'],
    ['/t/26-1'],
    ['/t/26-00001/extra'],
    ['/t/<b>hola</b>'],
    ['//malo.example/t/26-00001'],
    ['https://malo.example/t/26-00001'],
  ])('%s no es la ficha de un trabajo', (redirect) => {
    expect(redirectCaseCode(redirect)).toBeNull()
  })
})
