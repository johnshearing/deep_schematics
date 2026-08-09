import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4',
  {
    variants: {
      tone: {
        default: 'bg-muted text-muted-foreground',
        info: 'border-transparent bg-accent text-accent-foreground',
        warning: 'border-transparent bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
        danger: 'border-transparent bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
        success: 'border-transparent bg-[var(--color-success)]/15 text-[var(--color-success)]',
      },
    },
    defaultVariants: { tone: 'default' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
