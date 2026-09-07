import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

/** Envuelve `ui` en un `RouterProvider` mínimo para probar componentes que usan `<Link>`. */
export function renderWithRouter(ui: ReactElement) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory(),
  })
  return render(<RouterProvider router={router} />)
}
