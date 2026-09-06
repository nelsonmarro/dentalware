import { useState } from 'react'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { Odontogram } from './odontogram'

export function TeethDialog({
  open,
  onOpenChange,
  value,
  onSave,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: readonly number[]
  onSave: (teeth: number[]) => void
  title: string
}) {
  const [draft, setDraft] = useState<number[]>([...value])

  // Reinicia el borrador con el valor externo cada vez que el diálogo se abre,
  // ajustando el estado durante el render en lugar de en un efecto.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setDraft([...value])
  }

  function handleSave() {
    onSave(draft)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Odontogram value={draft} onChange={setDraft} />
        <p className="text-sm text-muted-foreground">{draft.length} piezas</p>
      </div>
    </FormDialog>
  )
}
