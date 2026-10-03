import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { CommentForm } from './comment-form'

describe('CommentForm', () => {
  it('enviar vacío muestra el error de validación', async () => {
    const onSubmit = vi.fn()
    const { user } = renderWithProviders(<CommentForm onSubmit={onSubmit} pending={false} />)
    await user.click(screen.getByRole('button', { name: 'Comentar' }))
    expect(await screen.findByText('Escribe un comentario')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('con texto llama a onSubmit y limpia el campo', async () => {
    const onSubmit = vi.fn()
    const { user } = renderWithProviders(<CommentForm onSubmit={onSubmit} pending={false} />)
    const textarea = screen.getByLabelText('Comentario')
    await user.type(textarea, 'Listo para retirar')
    await user.click(screen.getByRole('button', { name: 'Comentar' }))
    expect(onSubmit).toHaveBeenCalledWith({ text: 'Listo para retirar' })
    expect(textarea).toHaveValue('')
  })

  // UX3-26: el campo solo tenía placeholder; el piso de calidad pide etiqueta visible.
  it('el campo tiene la etiqueta visible «Comentario»', () => {
    renderWithProviders(<CommentForm onSubmit={vi.fn()} pending={false} />)
    const textarea = screen.getByLabelText('Comentario')
    const label = document.querySelector(`label[for="${textarea.id}"]`)
    expect(label).toHaveTextContent('Comentario')
    expect(label).toBeVisible()
  })
})
