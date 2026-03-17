'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const PRIORITY_COLORS: Record<string, string> = {
  P0: '#e05555', P1: '#f0a050', P2: '#7c6af5', P3: '#5a5868',
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getWeekStart(dk: string): string {
  const d = new Date(dk + 'T00:00:00')
  d.setDate(d.getDate() - d.getDay())
  return dateKey(d)
}

function formatWeekRange(weekStartKey: string): string {
  const start = new Date(weekStartKey + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${MONTHS[start.getMonth()]} ${start.getDate()} — ${MONTHS[end.getMonth()]} ${end.getDate()}`
}

type Task = { id: string; text: string; done: boolean; date: string; priority: string }
type JournalEntry = { date: string; wins: string | null; tasks_reflection: string | null; time_reflection: string | null; improve: string | null; quick_entry: string | null }
type WeeklyReview = { week_start: string; went_well: string; didnt_go_well: string; focus_next_week: string }

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: '6px',
      background: PRIORITY_COLORS[priority] + '22',
      color: PRIORITY_COLORS[priority],
      border: `1px solid ${PRIORITY_COLORS[priority]}44`,
      letterSpacing: '0.03em', flexShrink: 0
    }}>{priority}</span>
  )
}

export default function CalendarView({ user }: { user: User }) {
  const supabase = createClient()
  const today = new Date()
  const todayKey = dateKey(today)

  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey)
  const [tasks, setTasks] = useState<Task[]>([])
  const [journals, setJournals] = useState<JournalEntry[]>([])
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([])
  const [loading, setLoading] = useState(true)

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  const monthStartKey = dateKey(monthStart)
  const monthEndKey = dateKey(monthEnd)

  // Get week start and end for the selected date to fetch weekly review
  const selectedWeekStart = selectedDate ? getWeekStart(selectedDate) : null
  const selectedWeekEnd = selectedWeekStart ? (() => {
    const d = new Date(selectedWeekStart + 'T00:00:00')
    d.setDate(d.getDate() + 6)
    return dateKey(d)
  })() : null

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [t, j, wr] = await Promise.all([
      supabase.from('week_tasks').select('*').eq('user_id', user.id).gte('date', monthStartKey).lte('date', monthEndKey),
      supabase.from('journal_entries').select('*').eq('user_id', user.id).gte('date', monthStartKey).lte('date', monthEndKey),
      supabase.from('weekly_reviews').select('*').eq('user_id', user.id).gte('week_start', monthStartKey).lte('week_start', monthEndKey),
    ])
    setTasks(t.data || [])
    setJournals(j.data || [])
    setWeeklyReviews(wr.data || [])
    setLoading(false)
  }, [user.id, monthStartKey, monthEndKey, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  function getDaysInMonth() {
    const days = []
    const firstDay = monthStart.getDay()
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= monthEnd.getDate(); d++) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d))
    }
    return days
  }

  function getDayStatus(dk: string) {
    const dayTasks = tasks.filter(t => t.date === dk)
    const hasJournal = journals.some(j => j.date === dk)
    const allDone = dayTasks.length > 0 && dayTasks.every(t => t.done)
    const someDone = dayTasks.some(t => t.done)
    return { dayTasks, hasJournal, allDone, someDone }
  }

  const selectedTasks = selectedDate ? tasks.filter(t => t.date === selectedDate) : []
  const selectedJournal = selectedDate ? journals.find(j => j.date === selectedDate) : null
  const selectedWeeklyReview = selectedWeekStart ? weeklyReviews.find(wr => wr.week_start === selectedWeekStart) : null
  const selectedDateObj = selectedDate ? new Date(selectedDate + 'T00:00:00') : null
  const doneTasks = selectedTasks.filter(t => t.done).length

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: '0.9rem' }}>Loading...</div>
  )

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-syne)', fontSize: '1.1rem', fontWeight: 700 }}>Calendar</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>Click any day to see your full summary</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', cursor: 'pointer', padding: '6px 12px', fontSize: '14px' }}>←</button>
          <span style={{ fontFamily: 'var(--font-syne)', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text2)', minWidth: '130px', textAlign: 'center' }}>
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', cursor: 'pointer', padding: '6px 12px', fontSize: '14px' }}>→</button>
        </div>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {SHORT_DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text3)', padding: '4px 0', fontFamily: 'var(--font-syne)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '24px' }}>
        {getDaysInMonth().map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />
          const dk = dateKey(day)
          const { dayTasks, hasJournal, allDone, someDone } = getDayStatus(dk)
          const isToday = dk === todayKey
          const isSelected = dk === selectedDate
          const isFuture = dk > todayKey

          let bgColor = 'var(--bg2)'
          let borderColor = 'var(--border)'
          if (isSelected) { bgColor = 'var(--bg4)'; borderColor = 'var(--accent)' }
          else if (!isFuture && allDone && hasJournal) { borderColor = 'rgba(78,202,139,0.4)' }
          else if (!isFuture && (someDone || hasJournal)) { borderColor = 'rgba(240,160,80,0.4)' }

          return (
            <div key={dk} onClick={() => setSelectedDate(dk)} style={{
              background: bgColor, border: `1px solid ${borderColor}`,
              borderRadius: '10px', padding: '8px 6px', cursor: 'pointer',
              minHeight: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              transition: 'border-color 0.15s', opacity: isFuture ? 0.4 : 1
            }}>
              <span style={{
                fontFamily: 'var(--font-syne)', fontSize: '0.82rem', fontWeight: isToday ? 700 : 500,
                color: isToday ? 'var(--accent)' : 'var(--text2)',
                background: isToday ? 'var(--accent-dim)' : 'transparent',
                borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{day.getDate()}</span>

              {dayTasks.length > 0 && (
                <span style={{ fontSize: '0.65rem', color: allDone ? 'var(--green)' : 'var(--text3)' }}>
                  {dayTasks.filter(t => t.done).length}/{dayTasks.length}
                </span>
              )}

              <div style={{ display: 'flex', gap: '3px', marginTop: 'auto' }}>
                {dayTasks.length > 0 && (
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: allDone ? 'var(--green)' : someDone ? 'var(--amber)' : 'var(--text3)' }} />
                )}
                {hasJournal && (
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { color: 'var(--green)', label: 'All tasks done' },
          { color: 'var(--amber)', label: 'Partial / in progress' },
          { color: 'var(--text3)', label: 'Tasks added' },
          { color: 'var(--accent)', label: 'Journaled' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Day detail panel */}
      {selectedDate && selectedDateObj && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-syne)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
                {DAYS[selectedDateObj.getDay()]}, {MONTHS[selectedDateObj.getMonth()]} {selectedDateObj.getDate()}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '2px' }}>
                {selectedTasks.length > 0 ? `${doneTasks} of ${selectedTasks.length} tasks completed` : 'No tasks this day'}
              </div>
            </div>
            {selectedTasks.length > 0 && (
              <span style={{ fontSize: '0.78rem', fontWeight: 500, padding: '3px 10px', borderRadius: '20px',
                background: doneTasks === selectedTasks.length ? 'var(--green-dim)' : 'var(--amber-dim)',
                color: doneTasks === selectedTasks.length ? 'var(--green)' : 'var(--amber)',
                border: `1px solid ${doneTasks === selectedTasks.length ? 'rgba(78,202,139,0.2)' : 'rgba(240,160,80,0.2)'}` }}>
                {Math.round(doneTasks / selectedTasks.length * 100)}% done
              </span>
            )}
          </div>

          {/* Tasks */}
          {selectedTasks.length > 0 && (
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontFamily: 'var(--font-syne)' }}>Tasks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedTasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: t.done ? 0.5 : 1 }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `1.5px solid ${t.done ? 'var(--green)' : 'var(--border-hover)'}`, background: t.done ? 'var(--green)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {t.done && <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <PriorityBadge priority={t.priority || 'P1'} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Journal */}
          {selectedJournal ? (
            <div style={{ padding: '12px 18px', borderBottom: selectedWeeklyReview ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontFamily: 'var(--font-syne)' }}>Journal entry</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedJournal.quick_entry && (
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '4px', fontWeight: 500 }}>Quick entry</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text2)', lineHeight: 1.6 }}>{selectedJournal.quick_entry}</div>
                  </div>
                )}
                {[
                  { key: 'wins', label: 'Accomplished' },
                  { key: 'tasks_reflection', label: 'Tasks reflection' },
                  { key: 'time_reflection', label: 'Time spent' },
                  { key: 'improve', label: 'Improve tomorrow' },
                ].map(({ key, label }) => {
                  const val = selectedJournal[key as keyof JournalEntry]
                  if (!val) return null
                  return (
                    <div key={key}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '4px', fontWeight: 500 }}>{label}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text2)', lineHeight: 1.6 }}>{val}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px 18px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.82rem', borderBottom: selectedWeeklyReview ? '1px solid var(--border)' : 'none' }}>
              No journal entry for this day
            </div>
          )}

          {/* Weekly Review */}
          {selectedWeeklyReview && (
            <div style={{ padding: '12px 18px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontFamily: 'var(--font-syne)' }}>
                Weekly review — {selectedWeekStart ? formatWeekRange(selectedWeekStart) : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { key: 'went_well', label: 'What went well' },
                  { key: 'didnt_go_well', label: "What didn't go well" },
                  { key: 'focus_next_week', label: 'Focus next week' },
                ].map(({ key, label }) => {
                  const val = selectedWeeklyReview[key as keyof WeeklyReview]
                  if (!val) return null
                  return (
                    <div key={key}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '4px', fontWeight: 500 }}>{label}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text2)', lineHeight: 1.6 }}>{val}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}