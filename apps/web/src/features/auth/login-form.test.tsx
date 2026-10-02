import { waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { LoginForm } from './login-form'

describe('LoginForm', () => {
  it('marca el campo de correo con aria-invalid y aria-describedby cuando la validación falla', async () => {
    const user = userEvent.setup()
    const { getByRole, getByLabelText } = renderWithProviders(<LoginForm onSuccess={() => {}} />)

    await user.click(getByRole('button', { name: 'Ingresar' }))

    const email = getByLabelText('Correo')
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'))
    const describedBy = email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent('Correo inválido')
  })

  it('sin error no lleva aria-invalid ni aria-describedby', () => {
    const { getByLabelText } = renderWithProviders(<LoginForm onSuccess={() => {}} />)

    const email = getByLabelText('Correo')
    expect(email).not.toHaveAttribute('aria-invalid')
    expect(email).not.toHaveAttribute('aria-describedby')
  })
})
