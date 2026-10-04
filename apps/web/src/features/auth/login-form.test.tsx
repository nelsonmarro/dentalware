import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { LoginForm } from './login-form'
import { signIn, type SignInFailureReason } from './session'
import type * as SessionModule from './session'

// Frontera de `LoginForm` con la red (igual criterio que `mocks solo de api.ts`, pero para
// auth): `signIn` es la función de `session.ts`, nunca `authClient` importado directo aquí.
// `SIGN_IN_FAILURE_MESSAGE` se mantiene real (con `importOriginal`): el propio componente la
// importa para indexarla en tiempo de ejecución, así que mockearla rompería `LoginForm`, no
// solo el test. La tabla de abajo (`FAILURE_MESSAGE_BY_REASON`) es una copia literal e
// independiente, solo para comparar: nunca se importa esa constante aquí.
vi.mock('./session', async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  signIn: vi.fn(),
}))

// Ronda de fixes 2 (hallazgo I-2): tabla **literal**, no derivada de `SIGN_IN_FAILURE_MESSAGE`
// — comparar el componente contra la misma constante que usa por dentro no prueba nada (un
// mensaje cambiado a cualquier otra cosa seguiría pasando). El texto exacto viene de
// `session.ts`; si alguien lo cambia ahí sin querer, este test lo nota.
const FAILURE_MESSAGE_BY_REASON: Record<SignInFailureReason, string> = {
  credentials: 'Correo o contraseña incorrectos',
  banned: 'Tu usuario está bloqueado: pide a administración que lo reactive.',
  'rate-limited': 'Demasiados intentos: espera un minuto e intenta de nuevo.',
  network: 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
}

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

  // Ronda de fixes 1 (UX3-10), corregido en la ronda de fixes 2 (I-2): un motivo de `signIn`
  // sin mensaje no compila (`SIGN_IN_FAILURE_MESSAGE` es un `Record` exhaustivo en
  // `session.ts`) — lo que este test prueba es que, en el DOM, cada motivo muestra **ese
  // texto exacto**, no que el componente sepa indexar su propia constante.
  it.each(Object.entries(FAILURE_MESSAGE_BY_REASON) as [SignInFailureReason, string][])(
    'el motivo "%s" muestra "%s"',
    async (reason, message) => {
      vi.mocked(signIn).mockResolvedValue({ ok: false, reason })
      const user = userEvent.setup()
      const { getByRole, getByLabelText, findByRole } = renderWithProviders(
        <LoginForm onSuccess={() => {}} />,
      )

      await user.type(getByLabelText('Correo'), 'ana@labo.test')
      await user.type(getByLabelText('Contraseña'), 'secreto123')
      await user.click(getByRole('button', { name: 'Ingresar' }))

      expect(await findByRole('alert')).toHaveTextContent(message)
    },
  )

  it('los 4 mensajes son distintos entre sí (ninguno reciclado de otro motivo)', () => {
    const messages = Object.values(FAILURE_MESSAGE_BY_REASON)
    expect(new Set(messages).size).toBe(Object.keys(FAILURE_MESSAGE_BY_REASON).length)
  })
})
