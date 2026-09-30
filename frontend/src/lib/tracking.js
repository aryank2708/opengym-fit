// Helpers for the Saturday check-in and the M1–M5 meal log.
import { todayISO, isoOf } from './format.js'

export const MEALS = [1, 2, 3, 4, 5]

// Measurements are stored in inches; weight follows the profile unit (kg by default).
export const METRICS = [
  { k: 'w', label: 'Weight', hint: null, good: -1 },
  { k: 'neck', label: 'Neck', hint: null, good: 0, unit: 'in' },
  { k: 'waist', label: 'Abdomen', hint: 'at navel', good: -1, unit: 'in' },
  { k: 'hips', label: 'Hips', hint: null, good: -1, unit: 'in' },
  { k: 'chest', label: 'Chest', hint: null, good: 1, unit: 'in' },
  { k: 'bicep', label: 'Bicep', hint: null, good: 1, unit: 'in' }
]

export const mealsOf = (S, iso) => (S.meals && S.meals[iso]) || {}
export const dayKcal = (S, iso) => {
  const m = mealsOf(S, iso)
  let eaten = 0, planned = 0, ticked = 0
  for (const n of MEALS) {
    const e = m[n]; if (!e) continue
    planned += e.c || 0
    if (e.x) { eaten += e.c || 0; ticked++ }
  }
  return { eaten, planned, ticked }
}

export const shiftISO = (iso, days) => {
  const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + days); return isoOf(d)
}

// Most recent Saturday on or before today.
export const lastSaturday = (today = todayISO()) => {
  const d = new Date(today + 'T12:00:00')
  return shiftISO(today, -((d.getDay() + 1) % 7))
}

// Check-in status for the Home card: 'today' (Saturday, not logged), 'missed' (last Saturday
// not logged, it is a later day), or 'done' (logged since last Saturday).
export function checkinStatus(S, today = todayISO()) {
  const sat = lastSaturday(today)
  const done = (S.checkins || []).some(c => c.d >= sat)
  if (done) return 'done'
  return sat === today ? 'today' : 'missed'
}
