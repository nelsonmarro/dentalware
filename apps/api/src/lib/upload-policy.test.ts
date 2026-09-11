import { describe, expect, it } from 'vitest'
import { ALLOWED_MIME, isImage, MAX_UPLOAD_BYTES } from './upload-policy.ts'

describe('ALLOWED_MIME', () => {
  it('acepta imágenes jpeg/png/webp y PDF', () => {
    expect(ALLOWED_MIME).toEqual(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  })
})

describe('MAX_UPLOAD_BYTES', () => {
  it('limita las subidas a 25 MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024)
  })
})

describe('isImage', () => {
  it('reconoce un mime type de imagen', () => {
    expect(isImage('image/jpeg')).toBe(true)
  })

  it('no reconoce un PDF como imagen', () => {
    expect(isImage('application/pdf')).toBe(false)
  })
})
