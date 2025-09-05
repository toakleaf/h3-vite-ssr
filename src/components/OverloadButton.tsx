import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './OverloadButton.module.css'
import { DivOne } from './DivOne'
import { DivTwo } from './DivTwo'
import { DivThree } from './DivThree'

export type OverloadButtonProps = {
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>

export function OverloadButton({
  fullWidth = false,
  size = 'md',
  className,
  children = 'Orange Ombre',
  ...buttonProps
}: OverloadButtonProps) {
  const classNames = [
    styles.button,
    size && styles[size],
    fullWidth && styles.fullWidth,
    className
  ].filter(Boolean).join(' ')

  return (
    <button className={classNames} {...buttonProps}>
      <DivThree>
      <DivTwo>
      <DivOne>{children}</DivOne>
      </DivTwo>
      </DivThree>
    </button>
  )
}


