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

function formatDisplay(d: Date) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function formatShort(d: Date) {
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()}`
}

function getWeekDays() {
  const today = new Date()
  const days = []
  const curr = new Date(today)
  curr.setDate(curr.getDate() - curr.getDay())
  for (let i = 0; i < 7; i++) {
    days.push(new Date(curr))
    curr.setDate(curr.getDate() + 1)
  }
  return days
}

type Task = { id: string; text: string; done: boolean; date: string }
type Goal = { id: string; text: string; timeframe: string }
type Journal = { wins: string; tasks_reflection: string; time_reflection: string; improve: string }

export default function Dashboard({ user }: { user: User }) {
  const supabase = createClient()
  const today = new Date()
  const todayKey = dateKey(today)

  const [activeTab, setActiveTab] = useState('today')
  const [todayTasks, setTodayTasks] = useState<Task[]>([])
  const [weekTasks, setWeekTasks] = useState<Task[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [journal, setJournal] = useState<Journal>({ wins: '', tasks_reflection: '', time_reflection: '', improve: '' })
  const [journalOffset, setJournalOffset] = useState(0)
  const [openDays, setOpenDays] = useState<string[]>([todayKey])
  const [todayInput, setTodayInput] = useState('')
  const [weekInputs, setWeekInputs] = useState<Record<string, string>>({})
  const [goalInput, setGoalInput] = useState('')
  const [goalTimeframe, setGoalTimeframe] = useState('This month')
  const [saveStatus, setSaveStatus] = useState(false)
  const [loading, setLoading] = useState(true)

  const journalDate = new Date(today)
  journalDate.setDate(journalDate.getDate() + journalOffset)
  const journalKey = dateKey(journalDate)

  const fetchAll = useCallback(async () => {
    const [tt, wt, g] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user.id).eq('date', todayKey),
      supabase.from('week_tasks').select('*').eq('user_id', user.id),
      supabase.from('goals').select('*').eq('user_id', user.id).order('created_at'),
    ])
    setTodayTasks(tt.data || [])
    setWeekTasks(wt.data || [])
    setGoals(g.data || [])
    setLoading(false)
  }, [user.id, todayKey, supabase])

  const fetchJournal = useCallback(async () => {
    const { data } = await supabase.from('journal_entries').select('*').eq('user_id', user.id).eq('date', journalKey).single()
    setJournal(data || { wins: '', tasks_reflection: '', time_reflection: '', improve: '' })
  }, [user.id, journalKey, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchJournal() }, [fetchJournal])

  // Today tasks
  async function addTodayTask() {
    if (!todayInput.trim()) return
    const { data } = await supabase.from('tasks').insert({ user_id: user.id, text: todayInput.trim(), done: false, date: todayKey }).select().single()
    if (data) setTodayTasks(prev => [...prev, data])
    setTodayInput('')
  }

  async function toggleTodayTask(id: string, done: boolean) {
    await supabase.from('tasks').update({ done: !done }).eq('id', id)
    setTodayTasks(prev => prev.map(t => t.id === id ? { ...t, done: !done } : t))
  }

  async function deleteTodayTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTodayTasks(prev => prev.filter(t => t.id !== id))
  }

  // Week tasks
  async function addWeekTask(date: string) {
    const text = weekInputs[date]?.trim()
    if (!text) return
    const { data } = await supabase.from('week_tasks').insert({ user_id: user.id, text, done: false, date }).select().single()
    if (data) setWeekTasks(prev => [...prev, data])
    setWeekInputs(prev => ({ ...prev, [date]: '' }))
  }

  async function toggleWeekTask(id: string, done: boolean) {
    await supabase.from('week_tasks').update({ done: !done }).eq('id', id)
    setWeekTasks(prev => prev.map(t => t.id === id ? { ...t, done: !done } : t))
  }

  async function deleteWeekTask(id: string) {
    await supabase.from('week_tasks').delete().eq('id', id)
    setWeekTasks(prev => prev.filter(t => t.id !== id))
  }

  // Goals
  async function addGoal() {
    if (!goalInput.trim()) return
    const { data } = await supabase.from('goals').insert({ user_id: user.id, text: goalInput.trim(), timeframe: goalTimeframe }).select().single()
    if (data) setGoals(prev => [...prev, data])
    setGoalInput('')
  }

  async function deleteGoal(id: string) {
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  // Journal
  async function saveJournal() {
    await supabase.from('journal_entries').upsert({ user_id: user.id, date: journalKey, ...journal }, { onConflict: 'user_id,date' })
    setSaveStatus(true)
    setTimeout(() => setSaveStatus(false), 2000)
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const doneTasks = todayTasks.filter(t => t.done).length
  const pct = todayTasks.length ? Math.round(doneTasks / todayTasks.length * 100) : 0
  const weekDays = getWeekDays()

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text3)', fontSize: '0.9rem' }}>
      Loading...
    </div>
  )

  return (
    <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px', margin: '0 auto', padding: '48px 24px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: '40px', paddingBottom: '28px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '6px' }}>
              Clear<span style={{ color: 'var(--accent)' }}>path</span>
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text3)' }}>Daily tasks. Weekly goals. Monthly vision. All in one place.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-syne)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {MONTHS[today.getMonth()]} {today.getDate()}, {today.getFullYear()}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text3)', marginTop: '2px' }}>{DAYS[today.getDay()]}</div>
            </div>
            <button onClick={signOut} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', color: 'var(--text3)', fontSize: '0.78rem', cursor: 'pointer' }}>
              Sign out
            </button>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '28px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px' }}>
          {['today', 'week', 'goals', 'journal'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '9px 12px', border: activeTab === tab ? '1px solid var(--border-hover)' : '1px solid transparent',
              borderRadius: '9px', background: activeTab === tab ? 'var(--bg4)' : 'transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--text3)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
              textTransform: 'capitalize'
            }}>
              {tab === 'today' ? 'Today' : tab === 'week' ? 'This Week' : tab === 'goals' ? 'Big Goals' : 'Journal'}
            </button>
          ))}
        </div>
      </div>

      {/* TODAY */}
      {activeTab === 'today' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-syne)', fontSize: '1.1rem', fontWeight: 700 }}>Today&apos;s Tasks</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>
                {todayTasks.length ? `${doneTasks} of ${todayTasks.length} completed` : 'No tasks yet'}
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(124,106,245,0.2)' }}>
              {todayTasks.length} {todayTasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <div style={{ height: '3px', background: 'var(--bg4)', borderRadius: '2px', marginBottom: '20px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input value={todayInput} onChange={e => setTodayInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodayTask()}
              placeholder="Add a task for today..." style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }} />
            <button onClick={addTodayTask} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: '#fff', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}>+ Add</button>
          </div>
          <TaskList tasks={todayTasks} onToggle={(id, done) => toggleTodayTask(id, done)} onDelete={deleteTodayTask} />
        </div>
      )}

      {/* WEEK */}
      {activeTab === 'week' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-syne)', fontSize: '1.1rem', fontWeight: 700 }}>This Week</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>Plan your week ahead</div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(78,202,139,0.2)' }}>Week view</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {weekDays.map(day => {
              const dk = dateKey(day)
              const isToday = dk === todayKey
              const tasks = weekTasks.filter(t => t.date === dk)
              const done = tasks.filter(t => t.done).length
              const isOpen = openDays.includes(dk)
              return (
                <div key={dk} style={{ background: 'var(--bg2)', border: `1px solid ${isToday ? 'rgba(124,106,245,0.3)' : 'var(--border)'}`, borderRadius: '12px', overflow: 'hidden' }}>
                  <div onClick={() => setOpenDays(prev => prev.includes(dk) ? prev.filter(d => d !== dk) : [...prev, dk])}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--border)' : '1px solid transparent' }}>
                    <span style={{ fontFamily: 'var(--font-syne)', fontSize: '0.82rem', fontWeight: 700, color: isToday ? 'var(--accent)' : 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {isToday ? '★ ' : ''}{formatShort(day)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {tasks.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{done}/{tasks.length}</span>}
                      <span style={{ color: 'var(--text3)', fontSize: '12px', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '10px 14px 12px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <input value={weekInputs[dk] || ''} onChange={e => setWeekInputs(prev => ({ ...prev, [dk]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addWeekTask(dk)} placeholder="Add task..."
                          style={{ flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }} />
                        <button onClick={() => addWeekTask(dk)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '0.82rem', cursor: 'pointer' }}>+</button>
                      </div>
                      <TaskList tasks={tasks} onToggle={(id, done) => toggleWeekTask(id, done)} onDelete={deleteWeekTask} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* GOALS */}
      {activeTab === 'goals' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-syne)', fontSize: '1.1rem', fontWeight: 700 }}>Big Goals</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>What you&apos;re building towards</div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(240,160,80,0.2)' }}>
              {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input value={goalInput} onChange={e => setGoalInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addGoal()}
              placeholder="Add a goal..." style={{ flex: 1, minWidth: '160px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }} />
            <select value={goalTimeframe} onChange={e => setGoalTimeframe(e.target.value)}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', color: 'var(--text2)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
              <option>This month</option>
              <option>Next 3 months</option>
              <option>Next 6 months</option>
              <option>This year</option>
            </select>
            <button onClick={addGoal} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: '#fff', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}>+ Add</button>
          </div>
          {goals.length === 0
            ? <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text3)', fontSize: '0.85rem', border: '1px dashed var(--border)', borderRadius: '12px' }}>No goals yet — what are you working towards?</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {goals.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '13px 14px' }}
                  onMouseEnter={e => (e.currentTarget.querySelector('.del') as HTMLElement).style.opacity = '1'}
                  onMouseLeave={e => (e.currentTarget.querySelector('.del') as HTMLElement).style.opacity = '0'}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--amber)', flexShrink: 0, marginTop: '6px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{g.text}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '3px' }}>{g.timeframe}</div>
                  </div>
                  <button className="del" onClick={() => deleteGoal(g.id)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', fontSize: '16px' }}>✕</button>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* JOURNAL */}
      {activeTab === 'journal' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-syne)', fontSize: '1.1rem', fontWeight: 700 }}>Daily Journal</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>Reflect on your day</div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(124,106,245,0.2)' }}>Log</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => setJournalOffset(p => p - 1)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', cursor: 'pointer', padding: '6px 12px', fontSize: '14px' }}>←</button>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-syne)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text2)' }}>{formatDisplay(journalDate)}</div>
            <button onClick={() => setJournalOffset(p => p + 1)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', cursor: 'pointer', padding: '6px 12px', fontSize: '14px' }}>→</button>
          </div>
          {[
            { key: 'wins', label: 'What did I accomplish today?' },
            { key: 'tasks_reflection', label: 'Did I complete my tasks?' },
            { key: 'time_reflection', label: 'How did I spend my time?' },
            { key: 'improve', label: "What's one thing to improve tomorrow?" },
          ].map(({ key, label }) => (
            <div key={key} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-syne)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
              <textarea value={journal[key as keyof Journal]} onChange={e => setJournal(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder="Write here..." rows={3}
                style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px 14px', color: 'var(--text)', fontSize: '0.88rem', lineHeight: 1.7, resize: 'none', outline: 'none' }} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
            {saveStatus && <span style={{ fontSize: '0.78rem', color: 'var(--green)' }}>Saved ✓</span>}
            <button onClick={saveJournal} style={{ background: 'var(--bg3)', border: '1px solid var(--border-hover)', borderRadius: '8px', padding: '8px 20px', color: 'var(--text)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>Save Entry</button>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskList({ tasks, onToggle, onDelete }: { tasks: Task[], onToggle: (id: string, done: boolean) => void, onDelete: (id: string) => void }) {
  if (!tasks.length) return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontSize: '0.82rem', border: '1px dashed var(--border)', borderRadius: '10px' }}>No tasks yet</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {tasks.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', opacity: t.done ? 0.45 : 1 }}
          onMouseEnter={e => (e.currentTarget.querySelector('.del') as HTMLElement).style.opacity = '1'}
          onMouseLeave={e => (e.currentTarget.querySelector('.del') as HTMLElement).style.opacity = '0'}>
          <div onClick={() => onToggle(t.id, t.done)} style={{ width: '18px', height: '18px', borderRadius: '50%', border: `1.5px solid ${t.done ? 'var(--green)' : 'var(--border-hover)'}`, background: t.done ? 'var(--green)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {t.done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
          <button className="del" onClick={() => onDelete(t.id)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', fontSize: '16px' }}>✕</button>
        </div>
      ))}
    </div>
  )
}