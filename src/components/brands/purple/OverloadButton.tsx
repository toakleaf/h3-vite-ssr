import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from '../../OverloadButton.module.css'

export type OverloadButtonProps = {
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

function composeClassNames(
  base: string,
  options: { size?: 'sm' | 'md' | 'lg'; fullWidth?: boolean; extra?: string }
) {
  const parts = [base]
  if (options.size && styles[options.size]) parts.push(styles[options.size])
  if (options.fullWidth) parts.push(styles.fullWidth)
  if (options.extra) parts.push(options.extra)
  return parts.join(' ')
}

export function OverloadButton({
  fullWidth = false,
  size = 'md',
  className,
  children = 'Purple Ombre',
  ...buttonProps
}: OverloadButtonProps) {
  const classNames = composeClassNames(styles.button, {
    size,
    fullWidth,
    extra: className
  })

  return (
    <button className={classNames} data-size={size} {...buttonProps}>
      <span className={styles.label}>{children}</span>
    </button>
  )
}


