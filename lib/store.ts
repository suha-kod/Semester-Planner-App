// lib/store.ts — Zustand store, hydrates from IndexedDB on mount

import { create } from 'zustand'
import type {
  AppData, Profile, Semester, Unit, Assessment,
  WeeklyLog, WeeklyItem, StudyHour, PlannerTask,
  Habit, HabitCheckIn, MoodEntry,
} from '@/types'
import { defaultAppData } from './migrations'
import { loadFromDB, saveToDB } from './db'

// ── Helpers ──────────────────────────────────────────────────────────────────
function uid(): string {
  return '_' + Math.random().toString(36).slice(2, 11)
}

// ── Store shape ───────────────────────────────────────────────────────────────
interface TrackerStore extends AppData {
  hydrated: boolean

  // Lifecycle
  hydrate: () => Promise<void>
  persist: () => void

  // Profile
  updateProfile: (patch: Partial<Profile>) => void

  // Semesters
  updateSemester: (patch: Partial<Semester>) => void

  // Units
  addUnit: (unit: Omit<Unit, 'id'>) => Unit
  updateUnit: (id: string, patch: Partial<Unit>) => void
  deleteUnit: (id: string) => void

  // Assessments
  addAssessment: (a: Omit<Assessment, 'id'>) => Assessment
  updateAssessment: (id: string, patch: Partial<Assessment>) => void
  deleteAssessment: (id: string) => void
  bulkAddAssessments: (items: Omit<Assessment, 'id'>[], clearUnitIds?: string[]) => void

  // Weekly logs
  setWeeklyItems: (unitId: string, week: number, labels: string[]) => void
  toggleWeeklyItem: (unitId: string, week: number, itemId: string) => void

  // Study hours
  addStudyHours: (entry: Omit<StudyHour, 'id'>) => void
  deleteStudyHours: (id: string) => void

  // Planner
  addPlannerTask: (task: Omit<PlannerTask, 'id'>) => void
  updatePlannerTask: (id: string, patch: Partial<PlannerTask>) => void
  deletePlannerTask: (id: string) => void

  // Habits
  addHabit: (h: Omit<Habit, 'id'>) => Habit
  updateHabit: (id: string, patch: Partial<Habit>) => void
  deleteHabit: (id: string) => void
  setHabitCheckIn: (habitId: string, date: string, count: number) => void

  // Mood / Mental State
  setMoodEntry: (date: string, mood: number, motivation: number) => void

  // Data management
  importData: (data: AppData) => void
  resetAll: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useStore = create<TrackerStore>((set, get) => ({
  ...defaultAppData(),
  hydrated: false,

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  hydrate: async () => {
    const data = await loadFromDB()
    set({ ...data, hydrated: true })
  },

  persist: () => {
    const state = get()
    const data: AppData = {
      version: state.version,
      profile: state.profile,
      semesters: state.semesters,
      activeSemesterId: state.activeSemesterId,
      units: state.units,
      assessments: state.assessments,
      weeklyLogs: state.weeklyLogs,
      studyHours: state.studyHours,
      plannerTasks: state.plannerTasks,
      habits: state.habits,
      habitCheckIns: state.habitCheckIns,
      moodEntries: state.moodEntries,
    }
    saveToDB(data)
  },

  // ── Profile ────────────────────────────────────────────────────────────────
  updateProfile: (patch) => {
    set(s => ({ profile: { ...s.profile, ...patch } }))
    get().persist()
  },

  // ── Semester ───────────────────────────────────────────────────────────────
  updateSemester: (patch) => {
    set(s => ({
      semesters: s.semesters.map(sem =>
        sem.id === s.activeSemesterId ? { ...sem, ...patch } : sem
      ),
    }))
    get().persist()
  },

  // ── Units ──────────────────────────────────────────────────────────────────
  addUnit: (unit) => {
    const newUnit: Unit = { ...unit, id: uid() }
    set(s => ({ units: [...s.units, newUnit] }))
    get().persist()
    return newUnit
  },

  updateUnit: (id, patch) => {
    set(s => ({ units: s.units.map(u => u.id === id ? { ...u, ...patch } : u) }))
    get().persist()
  },

  deleteUnit: (id) => {
    set(s => ({
      units: s.units.filter(u => u.id !== id),
      assessments: s.assessments.filter(a => a.unitId !== id),
      weeklyLogs: s.weeklyLogs.filter(l => l.unitId !== id),
    }))
    get().persist()
  },

  // ── Assessments ────────────────────────────────────────────────────────────
  addAssessment: (a) => {
    const newA: Assessment = { ...a, id: uid() }
    set(s => ({ assessments: [...s.assessments, newA] }))
    get().persist()
    return newA
  },

  updateAssessment: (id, patch) => {
    set(s => ({
      assessments: s.assessments.map(a => a.id === id ? { ...a, ...patch } : a),
    }))
    get().persist()
  },

  deleteAssessment: (id) => {
    set(s => ({ assessments: s.assessments.filter(a => a.id !== id) }))
    get().persist()
  },

  bulkAddAssessments: (items, clearUnitIds = []) => {
    const newItems: Assessment[] = items.map(a => ({ ...a, id: uid() }))
    set(s => ({
      assessments: [
        ...s.assessments.filter(a => !clearUnitIds.includes(a.unitId)),
        ...newItems,
      ],
    }))
    get().persist()
  },

  // ── Weekly logs ────────────────────────────────────────────────────────────
  setWeeklyItems: (unitId, week, labels) => {
    set(s => {
      const existing = s.weeklyLogs.find(l => l.unitId === unitId && l.week === week)
      const existingDone = new Set(existing?.items.filter(i => i.done).map(i => i.label) ?? [])
      const items: WeeklyItem[] = labels.map(label => ({
        id: uid(),
        label,
        type: 'weekly',
        done: existingDone.has(label),
      }))
      const log: WeeklyLog = { id: uid(), unitId, week, items }
      return {
        weeklyLogs: [
          ...s.weeklyLogs.filter(l => !(l.unitId === unitId && l.week === week)),
          log,
        ],
      }
    })
    get().persist()
  },

  toggleWeeklyItem: (unitId, week, itemId) => {
    set(s => ({
      weeklyLogs: s.weeklyLogs.map(l => {
        if (l.unitId !== unitId || l.week !== week) return l
        return {
          ...l,
          items: l.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i),
        }
      }),
    }))
    get().persist()
  },

  // ── Study hours ────────────────────────────────────────────────────────────
  addStudyHours: (entry) => {
    const newEntry: StudyHour = { ...entry, id: uid() }
    set(s => ({ studyHours: [...s.studyHours, newEntry] }))
    get().persist()
  },

  deleteStudyHours: (id) => {
    set(s => ({ studyHours: s.studyHours.filter(h => h.id !== id) }))
    get().persist()
  },

  // ── Planner ────────────────────────────────────────────────────────────────
  addPlannerTask: (task) => {
    const newTask: PlannerTask = { ...task, id: uid() }
    set(s => ({ plannerTasks: [...s.plannerTasks, newTask] }))
    get().persist()
  },

  updatePlannerTask: (id, patch) => {
    set(s => ({
      plannerTasks: s.plannerTasks.map(t => t.id === id ? { ...t, ...patch } : t),
    }))
    get().persist()
  },

  deletePlannerTask: (id) => {
    set(s => ({ plannerTasks: s.plannerTasks.filter(t => t.id !== id) }))
    get().persist()
  },

  // ── Habits ─────────────────────────────────────────────────────────────────
  addHabit: (h) => {
    const newHabit: Habit = { ...h, id: uid() }
    set(s => ({ habits: [...s.habits, newHabit] }))
    get().persist()
    return newHabit
  },

  updateHabit: (id, patch) => {
    set(s => ({ habits: s.habits.map(h => h.id === id ? { ...h, ...patch } : h) }))
    get().persist()
  },

  deleteHabit: (id) => {
    set(s => ({
      habits: s.habits.filter(h => h.id !== id),
      habitCheckIns: s.habitCheckIns.filter(c => c.habitId !== id),
    }))
    get().persist()
  },

  setHabitCheckIn: (habitId, date, count) => {
    set(s => {
      const existing = s.habitCheckIns.find(c => c.habitId === habitId && c.date === date)
      if (count === 0) {
        return { habitCheckIns: s.habitCheckIns.filter(c => !(c.habitId === habitId && c.date === date)) }
      }
      if (existing) {
        return { habitCheckIns: s.habitCheckIns.map(c => c.habitId === habitId && c.date === date ? { ...c, count } : c) }
      }
      return { habitCheckIns: [...s.habitCheckIns, { id: uid(), habitId, date, count }] }
    })
    get().persist()
  },

  // ── Mood ──────────────────────────────────────────────────────────────────
  setMoodEntry: (date, mood, motivation) => {
    set(s => {
      const existing = s.moodEntries.find(e => e.date === date)
      if (existing) {
        return { moodEntries: s.moodEntries.map(e => e.date === date ? { ...e, mood, motivation } : e) }
      }
      return { moodEntries: [...s.moodEntries, { id: uid(), date, mood, motivation }] }
    })
    get().persist()
  },

  // ── Data management ────────────────────────────────────────────────────────
  importData: (data) => {
    set({ ...data, hydrated: true })
    saveToDB(data)
  },

  resetAll: () => {
    const fresh = defaultAppData()
    set({ ...fresh, hydrated: true })
    saveToDB(fresh)
  },
}))

// Convenience selector for the active semester
export function useActiveSemester() {
  return useStore(s => s.semesters.find(sem => sem.id === s.activeSemesterId))
}
