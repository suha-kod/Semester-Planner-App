// lib/migrations.ts

import type { AppData, Profile, Semester, Habit } from '@/types'

const TODAY = new Date().toISOString().split('T')[0]

export const CURRENT_VERSION = 1

export function defaultProfile(): Profile {
  return {
    name: '',
    studyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    weeklyHoursTarget: 20,
    studyStyle: 'deadline',
    remindDays: 3,
    theme: 'dark',
    accentColor: 'pink',
    habitStartDate: TODAY,
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

export const DEFAULT_HABITS: Omit<Habit, 'id' | 'createdAt'>[] = [
  { title: 'Lecture', unitId: null, frequency: 'daily', targetCount: 1, colour: '#ec4899', emoji: '📖', active: true },
  { title: 'Tutorial', unitId: null, frequency: 'weekly', targetCount: 1, colour: '#2dd4a0', emoji: '💡', active: true },
  { title: 'Notes', unitId: null, frequency: 'daily', targetCount: 1, colour: '#60a5fa', emoji: '✍️', active: true },
  { title: 'Practice questions', unitId: null, frequency: 'daily', targetCount: 1, colour: '#f5a623', emoji: '🧠', active: true },
]

export function defaultAppData(): AppData {
  const sem = defaultSemester()
  const today = new Date().toISOString().split('T')[0]
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
    habits: DEFAULT_HABITS.map((h, i) => ({ ...h, id: `habit_default_${i}`, createdAt: today })),
    habitCheckIns: [],
    moodEntries: [],
  }
}

// Add new migrations here as the schema evolves.
export function migrateData(raw: AppData): AppData {
  let data = { ...raw } as any

  // v0 → v1: ensure breakWeeks exists on all semesters
  if (!data.version || data.version < 1) {
    data.semesters = data.semesters.map((s: any) => ({ ...s, breakWeeks: s.breakWeeks ?? [] }))
    data.version = 1
  }

  // Always ensure new top-level arrays exist (safe for any version)
  if (!data.habits) data.habits = []
  if (!data.habitCheckIns) data.habitCheckIns = []
  if (!data.moodEntries) data.moodEntries = []
  if (!data.profile.habitStartDate) data.profile.habitStartDate = TODAY
  if (!data.profile.accentColor) data.profile.accentColor = 'pink'

  // Ensure planner tasks have new optional fields
  data.plannerTasks = (data.plannerTasks || []).map((t: any) => ({
    assessmentId: null,
    status: t.done ? 'complete' : 'not-started',
    notes: '',
    ...t,
  }))

  return data as AppData
}
