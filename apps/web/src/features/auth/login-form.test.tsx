import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { LoginForm } from './login-form'
import { signIn } from './session'

// Frontera de `LoginForm` con la red (igual criterio que `mocks solo de api.ts`, pero para
// auth): `signIn` es la función de `session.ts`, nunca `authClient` importado directo aquí.
vi.mock('./session', () => ({ signIn: vi.fn() }))

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(signIn).mockReset()
  })

  it('con el correo vacío dice "Escribe tu correo" (no "Correo inválido", UX3-10)', async () => {
    const user = userEvent.setup()
    const { getByRole, getByLabelText } = renderWithProviders(<LoginForm onSuccess={() => {}} />)

    await user.click(getByRole('button', { name: 'Ingresar' }))

    const email = getByLabelText('Correo')
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    const describedBy = email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent('Escribe tu correo')
  })

  it('un correo con formato incorrecto (no vacío) sigue diciendo "Correo inválido"', async () => {
    const user = userEvent.setup()
    const { getByRole, getByLabelText } = renderWithProviders(<LoginForm onSuccess={() => {}} />)

    await user.type(getByLabelText('Correo'), 'no-es-un-correo')
    await user.type(getByLabelText('Contraseña'), 'secreto123')
    await user.click(getByRole('button', { name: 'Ingresar' }))

    const email = getByLabelText('Correo')
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    const describedBy = email.getAttribute('aria-describedby')
    expect(document.getElementById(describedBy!)).toHaveTextContent('Correo inválido')
  })

  it('sin error no lleva aria-invalid ni aria-describedby', () => {
    const { getByLabelText } = renderWithProviders(<LoginForm onSuccess={() => {}} />)

    const email = getByLabelText('Correo')
    expect(email).not.toHaveAttribute('aria-invalid')
    expect(email).not.toHaveAttribute('aria-describedby')
  })

  // UX3-10: credenciales incorrectas (401) es lo único que el usuario puede corregir
  // reescribiendo el formulario; el mensaje lo dice así.
  it('credenciales incorrectas muestran "Correo o contraseña incorrectos"', async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: false, reason: 'credentials' })
    const user = userEvent.setup()
    const { getByRole, getByLabelText, findByRole } = renderWithProviders(
      <LoginForm onSuccess={() => {}} />,
    )

    await user.type(getByLabelText('Correo'), 'ana@labo.test')
    await user.type(getByLabelText('Contraseña'), 'secreto123')
    await user.click(getByRole('button', { name: 'Ingresar' }))

    expect(await findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos')
  })

  // UX3-02/UX3-10: un fallo de red o del servidor no es "corrige tu contraseña" — mensaje
  // distinto, y la promesa de `signIn` nunca queda sin atrapar (ver `session.test.ts`).
  it('un fallo de red muestra un aviso de conexión, distinto del de credenciales', async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: false, reason: 'network' })
    const user = userEvent.setup()
    const { getByRole, getByLabelText, findByRole } = renderWithProviders(
      <LoginForm onSuccess={() => {}} />,
    )

    await user.type(getByLabelText('Correo'), 'ana@labo.test')
    await user.type(getByLabelText('Contraseña'), 'secreto123')
    await user.click(getByRole('button', { name: 'Ingresar' }))

    const alert = await findByRole('alert')
    expect(alert).toHaveTextContent('No se pudo conectar con el servidor')
    expect(alert).not.toHaveTextContent('Correo o contraseña incorrectos')
  })
})
