import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { PhotosTab } from './photos-tab'

const { fetchAttachments } = vi.hoisted(() => ({ fetchAttachments: vi.fn() }))
vi.mock('./attachments-api', () => ({
  fetchAttachments,
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
}))

function adjunto(id: string, kind: string, mime: string) {
  return {
    id,
    caseId: 'c1',
    kind,
    filename: `${id}.${mime === 'application/pdf' ? 'pdf' : 'png'}`,
    mime,
    size: 1,
    width: null,
    height: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    uploadedBy: null,
    url: `/api/adjuntos/${id}`,
    thumbUrl: null,
  }
}

/** I-1 de la revisión de la Tarea 5: la grilla de fotos usa la misma regla que la ficha corta
 * (`isPhoto`, por MIME), no `kind`, que el cliente puede forzar. */
describe('PhotosTab', () => {
  it('una imagen «scan» va a la grilla de fotos y un PDF a la lista de documentos', async () => {
    fetchAttachments.mockResolvedValue([
      adjunto('escaneo', 'scan', 'image/png'),
      adjunto('orden', 'photo', 'application/pdf'),
    ])

    renderWithProviders(<PhotosTab caseId="c1" role="tecnico" />)

    expect(await screen.findByRole('img', { name: 'escaneo.png' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'orden.pdf' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'orden.pdf' })).toHaveAttribute(
      'href',
      '/api/adjuntos/orden',
    )
  })

  // UX3-16: quién borra sale de `ATTACHMENT_DELETE_ROLES` (shared), no de una lista a mano.
  it.each([
    ['admin', true],
    ['recepcion', true],
    ['tecnico', false],
    ['mensajero', false],
  ] as const)('%s ve «Eliminar» en las fotos: %s', async (role, visible) => {
    fetchAttachments.mockResolvedValue([adjunto('foto', 'photo', 'image/png')])
    renderWithProviders(<PhotosTab caseId="c1" role={role} />)
    await screen.findByRole('img', { name: 'foto.png' })
    expect(Boolean(screen.queryByRole('button', { name: 'Eliminar foto.png' }))).toBe(visible)
  })

  // Decisión 11 del plan + revisión de la Tarea 4: la foto del mensajero es la constancia,
  // dentro del diálogo de entrega; la API le responde 403 a cualquier otro adjunto.
  it('el mensajero no ve «Añadir foto» ni «Subir archivo»; técnico, recepción y admin sí', async () => {
    fetchAttachments.mockResolvedValue([])
    const { unmount } = renderWithProviders(<PhotosTab caseId="c1" role="mensajero" />)
    expect(await screen.findByText('Sin fotos ni documentos todavía')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir foto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Subir archivo' })).not.toBeInTheDocument()
    unmount()

    for (const role of ['tecnico', 'recepcion', 'admin'] as const) {
      const r = renderWithProviders(<PhotosTab caseId="c1" role={role} />)
      expect(screen.getByRole('button', { name: 'Añadir foto' })).toBeInTheDocument()
      r.unmount()
    }
  })
})
