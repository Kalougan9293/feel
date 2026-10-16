import {
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from 'react'

/** Si on vient de taper « - » + espace en début de ligne → « • ». */
function applyDashSpaceBullet(
  value: string,
  cursor: number,
): { value: string; cursor: number } | null {
  if (cursor < 2) return null
  if (value.slice(cursor - 2, cursor) !== '- ') return null
  const dashAt = cursor - 2
  if (dashAt > 0 && value[dashAt - 1] !== '\n') return null
  return {
    value: `${value.slice(0, dashAt)}• ${value.slice(cursor)}`,
    cursor: dashAt + 2,
  }
}

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  value: string
  onChange: (value: string) => void
}

/** Textarea : « -[espace] » en début de ligne devient une puce. */
export function BulletTextarea({ value, onChange, ...rest }: Props) {
  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target
    const cursor = el.selectionStart ?? 0
    const next = applyDashSpaceBullet(el.value, cursor)
    if (next) {
      onChange(next.value)
      requestAnimationFrame(() => {
        el.setSelectionRange(next.cursor, next.cursor)
      })
    } else {
      onChange(el.value)
    }
  }

  return <textarea value={value} onChange={handleChange} {...rest} />
}
