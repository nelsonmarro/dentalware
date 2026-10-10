import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@/components/ui/sonner'

export type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster position="top-center" richColors />
      {/* Fuera de la orden impresa y de la barra inferior móvil (ver el mismo comentario en
       * `main.tsx`). */}
      {import.meta.env.DEV && (
        <div className="hidden lg:block print:hidden">
          <TanStackRouterDevtools position="bottom-right" />
        </div>
      )}
    </>
  ),
})
