import { Badge } from '@/components/ui/badge'

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-accent text-accent-foreground hover:bg-accent">Activo</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inactivo
    </Badge>
  )
}
