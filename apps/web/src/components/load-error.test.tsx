import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoadError } from './load-error'

describe('LoadError', () => {
  it('muestra el aviso y un botón "Reintentar" de 44 px que llama a onRetry', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(<LoadError onRetry={onRetry} />)

    expect(screen.getByText('No se pudo cargar la información')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Reintentar' })
    expect(retry.className).toContain('h-11')

    await user.click(retry)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('acepta una descripción propia para la pantalla que lo use', () => {
    render(<LoadError description="No se pudieron cargar las fases." onRetry={() => {}} />)

    expect(screen.getByText('No se pudieron cargar las fases.')).toBeInTheDocument()
  })
})
