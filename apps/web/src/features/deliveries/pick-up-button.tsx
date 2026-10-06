import { Button } from '@/components/ui/button'
import { useCaseBusy } from '@/features/cases/use-case-busy'
import { usePickUp } from './use-pick-up'

/**
 * «Recogido» (#118): el mensajero recogió el trabajo en la clínica. Un toque, sin diálogo ni
 * foto: cierra la recogida, pero el trabajo sigue por recoger hasta «Recibido». Lo usan la
 * tarjeta de «Entregas» y la ficha corta; quién lo ve lo decide quien lo monta
 * (`offersPickUp`). Deshabilitado mientras el trabajo tenga otra acción en curso o en pausa
 * (`useCaseBusy`, M-4), para no repetirla sin red.
 */
export function PickUpButton({
  deliveryId,
  caseId,
  className,
}: {
  deliveryId: string
  caseId: string
  className?: string
}) {
  const pickUp = usePickUp(deliveryId, caseId)
  const { busy } = useCaseBusy(caseId)
  return (
    <Button className={className} disabled={busy} onClick={() => pickUp.mutate()}>
      Recogido
    </Button>
  )
}
