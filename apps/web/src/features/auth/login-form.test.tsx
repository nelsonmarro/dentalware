import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { LoginForm } from './login-form'
import { SIGN_IN_FAILURE_MESSAGE, signIn, type SignInFailureReason } from './session'
import type * as SessionModule from './session'

// Frontera de `LoginForm` con la red (igual criterio que `mocks solo de api.ts`, pero para
// auth): `signIn` es la función de `session.ts`, nunca `authClient` importado directo aquí.
// `SIGN_IN_FAILURE_MESSAGE` se mantiene real (con `importOriginal`): es el `Record` exhaustivo
// contra el que se comparan los mensajes, no algo que este test deba inventar.
vi.mock('./session', async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  signIn: vi.fn(),
}))

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

  // Ronda de fixes 1 (UX3-10): cada motivo de `signIn` tiene su propio mensaje, el mismo
  // `Record` exhaustivo que usa `LoginForm` (`SIGN_IN_FAILURE_MESSAGE`) — un motivo nuevo que
  // no esté aquí hace fallar este test, no solo el compilador.
  it.each(Object.keys(SIGN_IN_FAILURE_MESSAGE) as SignInFailureReason[])(
    'el motivo "%s" muestra su propio mensaje',
    async (reason) => {
      vi.mocked(signIn).mockResolvedValue({ ok: false, reason })
      const user = userEvent.setup()
      const { getByRole, getByLabelText, findByRole } = renderWithProviders(
        <LoginForm onSuccess={() => {}} />,
      )

      await user.type(getByLabelText('Correo'), 'ana@labo.test')
      await user.type(getByLabelText('Contraseña'), 'secreto123')
      await user.click(getByRole('button', { name: 'Ingresar' }))

      expect(await findByRole('alert')).toHaveTextContent(SIGN_IN_FAILURE_MESSAGE[reason])
    },
  )

  it('credenciales y red muestran mensajes distintos entre sí (no el mismo texto reciclado)', async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: false, reason: 'credentials' })
    const user = userEvent.setup()
    const { getByRole, getByLabelText, findByRole } = renderWithProviders(
      <LoginForm onSuccess={() => {}} />,
    )

    await user.type(getByLabelText('Correo'), 'ana@labo.test')
    await user.type(getByLabelText('Contraseña'), 'secreto123')
    await user.click(getByRole('button', { name: 'Ingresar' }))

    const alert = await findByRole('alert')
    expect(alert).toHaveTextContent('Correo o contraseña incorrectos')
    expect(alert).not.toHaveTextContent('No se pudo conectar con el servidor')
  })
})
