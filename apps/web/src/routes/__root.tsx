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
      {/* `print:hidden`: fuera de la orden impresa (ver el mismo comentario en `main.tsx`). */}
      {import.meta.env.DEV && (
        <div className="print:hidden">
          <TanStackRouterDevtools position="bottom-right" />
        </div>
      )}
    </>
  ),
})
