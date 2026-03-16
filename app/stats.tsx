'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

type Task = { id: string; done: boolean; date: string }
type JournalEntry = { date: string }

export default function StatsView({ user }: { user: User }) {
  const supabase = createClient()
  const today = new Date()

  const [tasks, setTasks] = useState<Task[]>([])
  const [journals, setJournals] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Last 30 days range
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  const rangeStart = dateKey(thirtyDaysAgo)
  const rangeEnd = dateKey(today)

  // This week range
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekStartKey = dateKey(weekStart)

  const fetchData = useCallback(async () => {
    const [t, j] = await Promise.all([
      supabase.from('week_tasks').select('id, done, date').eq('user_id', user.id).gte('date', rangeStart).lte('date', rangeEnd),
      supabase.from('journal_entries').select('date').eq('user_id', user.id).gte('date', rangeStart).lte('date', rangeEnd),
    ])
    setTasks(t.data || [])
    setJournals(j.data || [])
    setLoading(false)
  }, [user.id, rangeStart, rangeEnd, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // Overall completion rate
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.done).length
  const completionRate = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0

  // Journaling consistency — how many of last 30 days have an entry
  const journalDays = new Set(journals.map(j => j.date))
  const journalConsistency = Math.round(journalDays.size / 30 * 100)

  // Most productive day of the week
  const dayStats: Record<number, { total: number; done: number }> = {}
  for (let i = 0; i < 7; i++) dayStats[i] = { total: 0, done: 0 }
  tasks.forEach(t => {
    const d = new Date(t.date + 'T00:00:00')
    const dow = d.getDay()
    dayStats[dow].total++
    if (t.done) dayStats[dow].done++
  })
  let bestDay = 0
  let bestRate = 0
  Object.entries(dayStats).forEach(([dow, stats]) => {
    if (stats.total >= 2) {
      const rate = stats.done / stats.total
      if (rate > bestRate) { bestRate = rate; bestDay = Number(dow) }
    }
  })

  // This week daily bar chart data
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const dk = dateKey(d)
    const dayTasks = tasks.filter(t => t.date === dk)
    return {
      label: SHORT_DAYS[d.getDay()],
      date: dk,
      total: dayTasks.length,
      done: dayTasks.filter(t => t.done).length,
      isToday: dk === dateKey(today),
    }
  })
  const maxBarValue = Math.max(...weekDays.map(d => d.total), 1)

  // Last 30 days journal heatmap
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (29 - i))
    const dk = dateKey(d)
    const dayTasks = tasks.filter(t => t.date === dk)
    return {
      date: dk,
      hasJournal: journalDays.has(dk),
      allDone: dayTasks.length > 0 && dayTasks.every(t => t.done),
      someDone: dayTasks.some(t => t.done),
      hasTasks: dayTasks.length > 0,
      isFuture: dk > dateKey(today),
    }
  })

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: '0.9rem' }}>Loading...</div>
  )

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontFamily: 'var(--font-syne)', fontSize: '1.1rem', fontWeight: 700 }}>Stats</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>Your last 30 days at a glance</div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Task completion', value: `${completionRate}%`, sub: `${doneTasks} of ${totalTasks} tasks`, color: completionRate >= 80 ? 'var(--green)' : completionRate >= 50 ? 'var(--amber)' : 'var(--red)' },
          { label: 'Journal consistency', value: `${journalConsistency}%`, sub: `${journalDays.size} of 30 days`, color: journalConsistency >= 80 ? 'var(--green)' : journalConsistency >= 40 ? 'var(--amber)' : 'var(--red)' },
          { label: 'Best day', value: totalTasks > 0 ? DAYS[bestDay] : '—', sub: totalTasks > 0 ? `${Math.round(bestRate * 100)}% completion` : 'Not enough data', color: 'var(--accent)' },
          { label: 'Days journaled', value: String(journalDays.size), sub: 'in the last 30 days', color: 'var(--accent)' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-syne)', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, fontFamily: 'var(--font-syne)', color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '6px' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* This week bar chart */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
        <div style={{ fontFamily: 'var(--font-syne)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          This week — tasks per day
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' }}>
          {weekDays.map(day => {
            const heightPct = day.total ? (day.total / maxBarValue) * 100 : 0
            const doneHeightPct = day.done ? (day.done / maxBarValue) * 100 : 0
            return (
              <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
                  {day.total > 0 ? `${day.done}/${day.total}` : ''}
                </div>
                <div style={{ width: '100%', position: 'relative', height: `${Math.max(heightPct, 4)}%`, minHeight: day.total ? '8px' : '3px' }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', background: 'var(--bg4)', borderRadius: '4px 4px 0 0' }} />
                  {day.done > 0 && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(doneHeightPct / Math.max(heightPct, 0.1)) * 100}%`, background: day.isToday ? 'var(--accent)' : 'var(--green)', borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease' }} />
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: day.isToday ? 700 : 400, color: day.isToday ? 'var(--accent)' : 'var(--text3)', fontFamily: 'var(--font-syne)' }}>{day.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 30 day activity heatmap */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
        <div style={{ fontFamily: 'var(--font-syne)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Last 30 days — activity
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {last30Days.map(day => {
            let bg = 'var(--bg4)'
            if (!day.isFuture) {
              if (day.allDone && day.hasJournal) bg = '#4eca8b'
              else if (day.allDone || day.hasJournal) bg = '#7c6af5'
              else if (day.someDone) bg = '#f0a050'
              else if (day.hasTasks) bg = '#5a5868'
            }
            const isToday = day.date === dateKey(today)
            return (
              <div
                key={day.date}
                title={day.date}
                style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: bg,
                  border: isToday ? '2px solid var(--accent)' : '1px solid transparent',
                  opacity: day.isFuture ? 0.2 : 1,
                  transition: 'transform 0.1s',
                  cursor: 'default'
                }}
              />
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
          {[
            { color: '#4eca8b', label: 'All done + journaled' },
            { color: '#7c6af5', label: 'Tasks done or journaled' },
            { color: '#f0a050', label: 'Partial' },
            { color: '#5a5868', label: 'Tasks only' },
            { color: 'var(--bg4)', label: 'No activity' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day of week breakdown */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
        <div style={{ fontFamily: 'var(--font-syne)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Completion by day of week
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Array.from({ length: 7 }, (_, i) => {
            const stats = dayStats[i]
            const rate = stats.total >= 1 ? Math.round(stats.done / stats.total * 100) : null
            const isBest = i === bestDay && stats.total >= 2
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', fontSize: '0.78rem', color: isBest ? 'var(--accent)' : 'var(--text3)', fontWeight: isBest ? 600 : 400, fontFamily: 'var(--font-syne)', flexShrink: 0 }}>{SHORT_DAYS[i]}</div>
                <div style={{ flex: 1, height: '8px', background: 'var(--bg4)', borderRadius: '4px', overflow: 'hidden' }}>
                  {rate !== null && (
                    <div style={{ height: '100%', width: `${rate}%`, background: isBest ? 'var(--accent)' : 'var(--green)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                  )}
                </div>
                <div style={{ width: '48px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--text3)', flexShrink: 0 }}>
                  {rate !== null ? `${rate}%` : '—'}
                </div>
                <div style={{ width: '48px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text3)', flexShrink: 0 }}>
                  {stats.total > 0 ? `${stats.done}/${stats.total}` : ''}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}