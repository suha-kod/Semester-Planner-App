// lib/migrations.ts

import type { AppData, Profile, Semester } from '@/types'

export const CURRENT_VERSION = 1

export function defaultProfile(): Profile {
  return {
    name: '',
    studyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    weeklyHoursTarget: 20,
    studyStyle: 'deadline',
    remindDays: 3,
    theme: 'dark',
  }
}

export function defaultSemester(): Semester {
  const today = new Date()
  const end = new Date(today)
  end.setMonth(end.getMonth() + 4)
  return {
    id: `sem_${Date.now()}`,
    name: '',
    startDate: today.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    totalWeeks: 13,
    breakWeeks: [],
    gradeGoal: '',
    isActive: true,
  }
}

export function defaultAppData(): AppData {
  const sem = defaultSemester()
  return {
    version: CURRENT_VERSION,
    profile: defaultProfile(),
    semesters: [sem],
    activeSemesterId: sem.id,
    units: [],
    assessments: [],
    weeklyLogs: [],
    studyHours: [],
    plannerTasks: [],
  }
}

// Add new migrations here as the schema evolves.
// Each migration receives the previous data shape and returns the new one.
// This ensures users upgrading from older versions never lose data.
export function migrateData(raw: AppData): AppData {
  let data = { ...raw }

  // v0 → v1: ensure breakWeeks exists on all semesters
  if (!data.version || data.version < 1) {
    data.semesters = data.semesters.map(s => ({
      ...s,
      breakWeeks: s.breakWeeks ?? [],
    }))
    data.version = 1
  }

  // Future migrations go here:
  // if (data.version < 2) { ... data.version = 2 }

  return data
}
