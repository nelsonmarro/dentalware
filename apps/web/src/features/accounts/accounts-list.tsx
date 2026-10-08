import { LoadError } from '@/components/load-error'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AccountsTable } from './accounts-table'
import { useAccounts } from './use-accounts'

/**
 * Cuerpo de «Cuentas» (CTA-1): el interruptor «Ver todas las clínicas» (en la URL, lo maneja la
 * ruta) y la lista con sus estados de carga y de error. Un fallo de red nunca se muestra como
 * una lista vacía (`docs/conventions.md` §5): se pinta `LoadError`, sin robar el foco.
 */
export function AccountsList({
  todas,
  onTodasChange,
}: {
  todas: boolean
  onTodasChange: (todas: boolean) => void
}) {
  const accounts = useAccounts(todas)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-11 items-center gap-2">
        <Switch id="cuentas-todas" checked={todas} onCheckedChange={onTodasChange} />
        <Label htmlFor="cuentas-todas">Ver todas las clínicas</Label>
      </div>
      {accounts.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : accounts.isError ? (
        <LoadError onRetry={() => void accounts.refetch()} />
      ) : (
        <AccountsTable rows={accounts.data} todas={todas} />
      )}
    </div>
  )
}
