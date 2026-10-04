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

  // Ronda de fixes 1 (hallazgo Important de accesibilidad): un lector de pantalla debe
  // anunciar el error sin que el foco ya esté ahí, y el foco debe caer en la acción útil
  // («Reintentar») al montar — con guantes, no hay que buscarla.
  it('anuncia el mensaje con role="alert"', () => {
    render(<LoadError onRetry={() => {}} />)

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la información')
  })

  // Ronda de fixes 2 (hallazgo I-1): por defecto NO enfoca — si `LoadError` vive embebido
  // junto a otros controles (una pestaña, un interruptor), robar el foco al montar es peor
  // que no moverlo. Solo lo hace quien lo use como el error que sustituye toda la pantalla.
  it('sin autoFocus no enfoca "Reintentar"', () => {
    render(<LoadError onRetry={() => {}} />)

    expect(screen.getByRole('button', { name: 'Reintentar' })).not.toHaveFocus()
  })

  it('con autoFocus enfoca "Reintentar" al montar', () => {
    render(<LoadError onRetry={() => {}} autoFocus />)

    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus()
  })
})
