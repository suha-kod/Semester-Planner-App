export type AccentTheme = 'pink' | 'purple' | 'blue' | 'green' | 'red' | 'yellow' | 'orange' | 'brown'

export const ACCENT_THEMES: Record<AccentTheme, {
  label: string
  swatch: string
  accent: string
  accent2: string
  glow: string
  glowLight: string
}> = {
  pink:   { label:'Pink',   swatch:'#ec4899', accent:'#ec4899', accent2:'#be185d', glow:'rgba(236,72,153,0.18)',  glowLight:'rgba(219,39,119,0.13)' },
  purple: { label:'Purple', swatch:'#7c5cfc', accent:'#7c5cfc', accent2:'#5e3fde', glow:'rgba(124,92,252,0.18)', glowLight:'rgba(107,70,224,0.13)' },
  blue:   { label:'Blue',   swatch:'#3b82f6', accent:'#3b82f6', accent2:'#1d4ed8', glow:'rgba(59,130,246,0.18)', glowLight:'rgba(37,99,235,0.13)'  },
  green:  { label:'Green',  swatch:'#10b981', accent:'#10b981', accent2:'#047857', glow:'rgba(16,185,129,0.18)', glowLight:'rgba(5,150,105,0.13)'  },
  red:    { label:'Red',    swatch:'#ef4444', accent:'#ef4444', accent2:'#b91c1c', glow:'rgba(239,68,68,0.18)',  glowLight:'rgba(185,28,28,0.13)'  },
  yellow: { label:'Yellow', swatch:'#f59e0b', accent:'#f59e0b', accent2:'#b45309', glow:'rgba(245,158,11,0.18)', glowLight:'rgba(180,83,9,0.13)'  },
  orange: { label:'Orange', swatch:'#f97316', accent:'#f97316', accent2:'#c2410c', glow:'rgba(249,115,22,0.18)', glowLight:'rgba(194,65,12,0.13)'  },
  brown:  { label:'Brown',  swatch:'#b07040', accent:'#b07040', accent2:'#854d20', glow:'rgba(176,112,64,0.18)', glowLight:'rgba(133,77,32,0.13)'  },
}

export function applyAccentTheme(name: AccentTheme, isLight: boolean) {
  const t = ACCENT_THEMES[name]
  const root = document.documentElement
  root.style.setProperty('--accent',      t.accent)
  root.style.setProperty('--accent2',     t.accent2)
  root.style.setProperty('--accent-glow', isLight ? t.glowLight : t.glow)
}
