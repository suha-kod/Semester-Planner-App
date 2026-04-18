// types/index.ts — single source of truth for all data shapes

export type Theme = 'dark' | 'light'
export type GradeGoal = 'HD' | 'D' | 'CR' | 'P' | ''
export type StudyStyle = 'early' | 'steady' | 'deadline' | 'exam'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type Priority = 'high' | 'medium' | 'low'

export type AssessmentType =
  | 'assignment' | 'quiz' | 'exam' | 'midsem'
  | 'lab' | 'presentation' | 'group'
  | 'participation' | 'hurdle' | 'other'

export type AssessmentStatus =
  | 'not-started' | 'planned' | 'in-progress'
  | 'submitted' | 'graded' | 'overdue' | 'complete'

export type UnitType =
  | 'mixed' | 'assignment-heavy' | 'exam-heavy'
  | 'concept-heavy' | 'lab-heavy'

export interface Profile {
  name: string
  studyDays: string[]
  weeklyHoursTarget: number
  studyStyle: StudyStyle
  remindDays: number
  theme: Theme
  accentColor: string
  habitStartDate: string  // YYYY-MM-DD — day 1 / week 1 of habit tracking
}

export interface MoodEntry {
  id: string
  date: string        // YYYY-MM-DD
  mood: number        // 1–10
  motivation: number  // 1–10
}

export interface Semester {
  id: string
  name: string
  startDate: string       // YYYY-MM-DD
  endDate: string         // YYYY-MM-DD
  totalWeeks: number
  breakWeeks: number[]    // 1-based calendar weeks from start that are non-teaching
  gradeGoal: GradeGoal
  isActive: boolean
}

export interface Unit {
  id: string
  semesterId: string
  code: string
  name: string
  difficulty: number      // 1–10
  type: UnitType
  targetMark: number | null
  credits: number
  notes: string
  colour: string          // hex accent colour
}

export interface Assessment {
  id: string
  unitId: string
  name: string
  type: AssessmentType
  weight: number          // percentage 0–100
  dueDate: string | null  // YYYY-MM-DD
  personalDueDate: string | null
  maxMark: number
  mark: number | null
  status: AssessmentStatus
  specialRules: string
  notes: string
}

export interface WeeklyItem {
  id: string
  label: string
  type: string
  done: boolean
}

export interface WeeklyLog {
  id: string
  unitId: string
  week: number
  items: WeeklyItem[]
}

export interface StudyHour {
  id: string
  date: string            // YYYY-MM-DD
  hours: number
  unitId: string | null
  notes: string
}

export interface PlannerTask {
  id: string
  name: string
  date: string            // YYYY-MM-DD
  unitId: string | null
  assessmentId?: string | null
  priority: Priority
  estimatedHours: number
  done: boolean
  status?: 'not-started' | 'in-progress' | 'complete'
  notes?: string
  aiGenerated: boolean
  targetWeek?: number | null
  targetDeadlineDay?: string | null
}

export type HabitFrequency = 'daily' | 'weekly'

export interface Habit {
  id: string
  title: string
  unitId: string | null
  frequency: HabitFrequency
  targetCount: number     // completions expected per day (usually 1)
  colour: string          // hex
  emoji: string
  active: boolean
  createdAt: string       // YYYY-MM-DD
}

export interface HabitCheckIn {
  id: string
  habitId: string
  date: string            // YYYY-MM-DD
  count: number           // how many times completed on this date
}

export interface AppData {
  version: number
  profile: Profile
  semesters: Semester[]
  activeSemesterId: string
  units: Unit[]
  assessments: Assessment[]
  weeklyLogs: WeeklyLog[]
  studyHours: StudyHour[]
  plannerTasks: PlannerTask[]
  habits: Habit[]
  habitCheckIns: HabitCheckIn[]
  moodEntries: MoodEntry[]
}

// Derived / computed types
export interface RiskResult {
  level: RiskLevel
  score: number
  reasons: string[]
}

export interface PriorityItem {
  name: string
  meta: string
  score: number
  urgency: 'urgent' | 'soon' | ''
  unitCode?: string
}
