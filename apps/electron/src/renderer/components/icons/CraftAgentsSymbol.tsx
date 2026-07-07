interface CraftAgentsSymbolProps {
  className?: string
}

/**
 * ARCH Agentz OS "E" symbol - the small pixel art icon
 * Uses accent color from theme (currentColor from className)
 */
export function CraftAgentsSymbol({ className }: CraftAgentsSymbolProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2.5 1.5"
      />
      <circle
        cx="12"
        cy="12"
        r="2.2"
        fill="currentColor"
      />
    </svg>
  )
}
