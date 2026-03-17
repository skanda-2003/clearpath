'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

type MaintenanceTask = {
  id: string
  name: string
  frequency: string
  last_done: string | null
}

const FREQUENCY_DAYS: Record<string, number> = {
  'Weekly': 7,
  'Monthly': 30,
  'Every 3 months': 90,
  'Every 6 months': 180,
  'Yearly': 365,
}

function getNextDue(lastDone: string | null, frequency: string): Date | null {
  if (!lastDone) return null
  const last = new Date(lastDone + 'T00:00:00')
  const days = FREQUENCY_DAYS[frequency] || 30
  const next = new Date(last)
  next.setDate(next.getDate() + days)
  return next
}

function getDaysUntilDue(lastDone: string | null, frequency: string): number | null {
  const next = getNextDue(lastDone, frequency)
  if (!next) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function getStatusColor(daysUntil: number | null, lastDone: string | null): string {
  if (!lastDone) return '#e05555'
  if (daysUntil === null) return 'var(--text3)'
  if (daysUntil <= 0) return '#e05555'
  if (daysUntil <= 7) return '#f0a050'
  return '#4eca8b'
}

function getStatusLabel(daysUntil: number | null, lastDone: string | null): string {
  if (!lastDone) return 'Never done'
  if (daysUntil === null) return 'Due soon'
  if (daysUntil <= 0) return `Overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'}`
  if (daysUntil === 0) return 'Due today'
  if (daysUntil <= 7) return `Due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
  return `Due in ${daysUntil} days`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function MaintenanceView({ user }: { user: User }) {
  const supabase = createClient()

  const [tasks, setTasks] = useState<MaintenanceTask[]>([])
  const [newName, setNewName] = useState('')
  const [newFrequency, setNewFrequency] = useState('Monthly')
  const [customDateId, setCustomDateId] = useState<string | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')
    setTasks(data || [])
    setLoading(false)
  }, [user.id, supabase])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function addTask() {
    if (!newName.trim()) return
    const { data } = await supabase
      .from('maintenance_tasks')
      .insert({ user_id: user.id, name: newName.trim(), frequency: newFrequency, last_done: null })
      .select()
      .single()
    if (data) setTasks(prev => [...prev, data])
    setNewName('')
    setNewFrequency('Monthly')
  }

  async function markDone(id: string) {
    const today = todayStr()
    await supabase.from('maintenance_tasks').update({ last_done: today }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, last_done: today } : t))
  }

  async function setCustomLastDone(id: string) {
    if (!customDate) return
    await supabase.from('maintenance_tasks').update({ last_done: customDate }).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, last_done: customDate } : t))
    setCustomDateId(null)
    setCustomDate('')
  }

  async function deleteTask(id: string) {
    await supabase.from('maintenance_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const da = getDaysUntilDue(a.last_done, a.frequency) ?? -999
    const db = getDaysUntilDue(b.last_done, b.frequency) ?? -999
    if (!a.last_done) return -1
    if (!b.last_done) return 1
    return da - db
  })

  const overdueCount = tasks.filter(t => {
    const d = getDaysUntilDue(t.last_done, t.frequency)
    return !t.last_done || (d !== null && d <= 0)
  }).length

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: '0.9rem' }}>Loading...</div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-syne)', fontSize: '1.1rem', fontWeight: 700 }}>Maintenance</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>Recurring tasks that need doing every so often</div>
        </div>
        {overdueCount > 0 && (
          <span style={{ fontSize: '0.72rem', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: 'rgba(224,85,85,0.12)', color: '#e05555', border: '1px solid rgba(224,85,85,0.2)' }}>
            {overdueCount} overdue
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
          placeholder="e.g. Clean bathroom, Bike service..."
          style={{ flex: 1, minWidth: '160px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
        />
        <select
          value={newFrequency}
          onChange={e => setNewFrequency(e.target.value)}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', color: 'var(--text2)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
        >
          {Object.keys(FREQUENCY_DAYS).map(f => <option key={f}>{f}</option>)}
        </select>
        <button onClick={addTask} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: '#fff', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}>+ Add</button>
      </div>

      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text3)', fontSize: '0.85rem', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          No maintenance tasks yet — add things like cleaning, servicing, or monthly checks
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sortedTasks.map(task => {
            const daysUntil = getDaysUntilDue(task.last_done, task.frequency)
            const statusColor = getStatusColor(daysUntil, task.last_done)
            const statusLabel = getStatusLabel(daysUntil, task.last_done)
            const nextDue = getNextDue(task.last_done, task.frequency)
            const isOverdue = !task.last_done || (daysUntil !== null && daysUntil <= 0)
            const isSettingDate = customDateId === task.id

            return (
              <div key={task.id} style={{ background: 'var(--bg2)', border: `1px solid ${isOverdue ? 'rgba(224,85,85,0.25)' : 'var(--border)'}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px' }}
                  onMouseEnter={e => (e.currentTarget.querySelector('.m-del') as HTMLElement).style.opacity = '1'}
                  onMouseLeave={e => (e.currentTarget.querySelector('.m-del') as HTMLElement).style.opacity = '0'}
                >
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', marginBottom: '4px' }}>{task.name}</div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{task.frequency}</span>
                      {task.last_done && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                          Last done: {new Date(task.last_done + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {nextDue && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                          Next due: {nextDue.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <span style={{ fontSize: '0.72rem', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}33`, whiteSpace: 'nowrap', flexShrink: 0 }}>{statusLabel}</span>

                  <button
                    onClick={() => markDone(task.id)}
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border-hover)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text2)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; (e.currentTarget as HTMLElement).style.color = 'var(--green)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text2)' }}
                  >
                    Done today
                  </button>

                  <button
                    onClick={() => { setCustomDateId(isSettingDate ? null : task.id); setCustomDate(task.last_done || todayStr()) }}
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border-hover)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text2)', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Set date
                  </button>

                  <button className="m-del" onClick={() => deleteTask(task.id)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', fontSize: '16px', flexShrink: 0 }}>✕</button>
                </div>

                {/* Custom date picker */}
                {isSettingDate && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg3)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>Last done on:</span>
                    <input
                      type="date"
                      value={customDate}
                      max={todayStr()}
                      onChange={e => setCustomDate(e.target.value)}
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', color: 'var(--text)', fontSize: '0.82rem', outline: 'none', cursor: 'pointer' }}
                    />
                    <button
                      onClick={() => setCustomLastDone(task.id)}
                      style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '6px 14px', color: '#fff', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}
                    >Save</button>
                    <button
                      onClick={() => setCustomDateId(null)}
                      style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text3)', fontSize: '0.82rem', cursor: 'pointer' }}
                    >Cancel</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}