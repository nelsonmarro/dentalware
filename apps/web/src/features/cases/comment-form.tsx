import { commentSchema, type CommentInput } from '@dentalware/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

/** Textarea + botón "Comentar"; valida con `commentSchema` y limpia el campo al enviar. */
export function CommentForm({
  onSubmit,
  pending,
}: {
  onSubmit: (values: CommentInput) => void
  pending: boolean
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentInput>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: '' },
  })

  function submit(data: CommentInput) {
    onSubmit(data)
    reset()
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-2">
      <Field data-invalid={!!errors.text}>
        <Textarea
          {...register('text')}
          id="comment-text"
          aria-label="Comentario"
          aria-invalid={!!errors.text}
          placeholder="Escribe un comentario…"
          rows={3}
        />
        {errors.text && <FieldError errors={[errors.text]} />}
      </Field>
      <Button type="submit" className="h-11 self-end" disabled={pending}>
        {pending ? 'Enviando…' : 'Comentar'}
      </Button>
    </form>
  )
}
