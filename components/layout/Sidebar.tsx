'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useStore, useActiveSemester } from '@/lib/store'
import { currentWeekNumber } from '@/lib/weeks'
import {
  HomeIcon, BookOpenIcon, ClipboardDocumentListIcon,
  CalendarIcon, ChartBarIcon, Cog6ToothIcon,
} from './Icons'

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',    Icon: HomeIcon },
  { href: '/units',        label: 'Units',        Icon: BookOpenIcon },
  { href: '/assessments',  label: 'Assessments',  Icon: ClipboardDocumentListIcon },
  { href: '/planner',      label: 'Planner',      Icon: CalendarIcon },
  { href: '/insights',     label: 'Insights',     Icon: ChartBarIcon },
]

export function Sidebar() {
  const pathname = usePathname()
  const profile = useStore(s => s.profile)
  const updateProfile = useStore(s => s.updateProfile)
  const semester = useActiveSemester()
  const week = currentWeekNumber(semester)
  const isLight = profile.theme === 'light'

  return (
    <nav
      className="fixed top-0 left-0 bottom-0 flex flex-col z-50"
      style={{
        width: '220px',
        background: 'var(--bg2)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="font-serif text-xl" style={{ color: 'var(--text)', letterSpacing: '-0.3px' }}>
          Tracker
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text3)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          Semester HQ
        </div>
      </div>

      {/* Main nav */}
      <div className="py-3 flex-1 overflow-y-auto">
        <div className="section-heading px-6 mb-1">Main</div>
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-6 py-2.5 text-sm transition-colors"
              style={{
                color: active ? 'var(--accent)' : 'var(--text2)',
                background: active ? 'var(--accent-glow)' : 'transparent',
                borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                fontWeight: active ? 500 : 400,
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}

        <div className="section-heading px-6 mt-4 mb-1">Manage</div>
        <Link
          href="/settings"
          className="flex items-center gap-2.5 px-6 py-2.5 text-sm transition-colors"
          style={{
            color: pathname === '/settings' ? 'var(--accent)' : 'var(--text2)',
            background: pathname === '/settings' ? 'var(--accent-glow)' : 'transparent',
            borderLeft: `2px solid ${pathname === '/settings' ? 'var(--accent)' : 'transparent'}`,
          }}
        >
          <Cog6ToothIcon className="w-4 h-4 flex-shrink-0" />
          Settings
        </Link>
      </div>

      {/* Footer */}
      <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => updateProfile({ theme: isLight ? 'dark' : 'light' })}
          className="w-full flex items-center gap-2 text-xs mb-3 px-3 py-2 rounded-lg transition-colors"
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--border2)',
            color: 'var(--text2)',
            cursor: 'pointer',
          }}
        >
          <span>{isLight ? '🌙' : '☀️'}</span>
          <span>{isLight ? 'Dark mode' : 'Light mode'}</span>
        </button>

        {semester && (
          <div
            className="rounded-lg px-3 py-2.5 text-xs"
            style={{
              background: 'var(--accent-glow)',
              border: '1px solid rgba(124,92,252,0.25)',
            }}
          >
            <div style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '10px' }}>
              Current
            </div>
            <div className="font-medium mt-0.5" style={{ color: 'var(--accent)' }}>
              {semester.name}
            </div>
            <div style={{ color: 'var(--text2)' }}>
              Week {week} of {semester.totalWeeks}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
