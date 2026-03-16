'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import CalendarView from './calendar'
import ListsView from './lists'
import MaintenanceView from './maintenance'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
const PRIORITY_COLORS: Record<string, string> = {
  P0: '#e05555', P1: '#f0a050', P2: '#7c6af5', P3: '#5a5868',
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getWeekStart(d: Date): Date {
  const start = new Date(d)
  start.setDate(start.getDate() - start.getDay())
  start.setHours(0, 0, 0, 0)
  return start
}

function formatDisplay(d: Date) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function formatShort(d: Date) {
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()}`
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} — ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
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

function sortByPriority<T extends { priority: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

type Task = { id: string; text: string; done: boolean; date: string; priority: string }
type Goal = { id: string; text: string; timeframe: string; priority: string; completed: boolean; completed_at: string | null }
type Journal = { wins: string; tasks_reflection: string; time_reflection: string; improve: string; quick_entry: string }
type WeeklyReview = { went_well: string; didnt_go_well: string; focus_next_week: string }
type Streak = { current_streak: number; longest_streak: number; last_journal_date: string | null }

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

function PrioritySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px',
      padding: '8px 10px', color: PRIORITY_COLORS[value], fontSize: '0.82rem',
      outline: 'none', cursor: 'pointer', fontWeight: 600
    }}>
      <option value="P0">P0</option>
      <option value="P1">P1</option>
      <option value="P2">P2</option>
      <option value="P3">P3</option>
    </select>
  )
}

export default function Dashboard({ user }: { user: User }) {
  const supabase = createClient()
  const today = new Date()
  const todayKey = dateKey(today)

  const [activeTab, setActiveTab] = useState('today')
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [journal, setJournal] = useState<Journal>({ wins: '', tasks_reflection: '', time_reflection: '', improve: '', quick_entry: '' })
  const [journalMode, setJournalMode] = useState<'quick' | 'deep'>('quick')
  const [journalOffset, setJournalOffset] = useState(0)
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview>({ went_well: '', didnt_go_well: '', focus_next_week: '' })
  const [weekReviewOffset, setWeekReviewOffset] = useState(0)
  const [weekReviewSaveStatus, setWeekReviewSaveStatus] = useState(false)
  const [showWeeklyReview, setShowWeeklyReview] = useState(false)
  const [openDays, setOpenDays] = useState<string[]>([todayKey])
  const [todayInput, setTodayInput] = useState('')
  const [todayPriority, setTodayPriority] = useState('P1')
  const [weekInputs, setWeekInputs] = useState<Record<string, string>>({})
  const [weekPriorities, setWeekPriorities] = useState<Record<string, string>>({})
  const [goalInput, setGoalInput] = useState('')
  const [goalTimeframe, setGoalTimeframe] = useState('This month')
  const [goalPriority, setGoalPriority] = useState('P1')
  const [showAchieved, setShowAchieved] = useState(false)
  const [saveStatus, setSaveStatus] = useState(false)
  const [loading, setLoading] = useState(true)
  const [streak, setStreak] = useState<Streak>({ current_streak: 0, longest_streak: 0, last_journal_date: null })

  const journalDate = new Date(today)
  journalDate.setDate(journalDate.getDate() + journalOffset)
  const journalKey = dateKey(journalDate)

  const reviewWeekStart = getWeekStart(new Date())
  reviewWeekStart.setDate(reviewWeekStart.getDate() + weekReviewOffset * 7)
  const reviewWeekKey = dateKey(reviewWeekStart)

  const todayTasks = sortByPriority(allTasks.filter(t => t.date === todayKey))
  const activeGoals = sortByPriority(goals.filter(g => !g.completed))
  const achievedGoals = goals.filter(g => g.completed).sort((a, b) =>
    new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
  )

  // Week stats for weekly review
  const reviewWeekEnd = new Date(reviewWeekStart)
  reviewWeekEnd.setDate(reviewWeekEnd.getDate() + 6)
  const weekTasksForReview = allTasks.filter(t => t.date >= reviewWeekKey && t.date <= dateKey(reviewWeekEnd))
  const weekDoneCount = weekTasksForReview.filter(t => t.done).length
  const weekCompletionPct = weekTasksForReview.length ? Math.round(weekDoneCount / weekTasksForReview.length * 100) : 0

  const fetchAll = useCallback(async () => {
    const [wt, g, st] = await Promise.all([
      supabase.from('week_tasks').select('*').eq('user_id', user.id),
      supabase.from('goals').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('streaks').select('*').eq('user_id', user.id).single(),
    ])
    setAllTasks(wt.data || [])
    setGoals(g.data || [])
    if (st.data) setStreak(st.data)
    setLoading(false)
  }, [user.id, supabase])

  const fetchJournal = useCallback(async () => {
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', journalKey)
      .single()
    setJournal(data || { wins: '', tasks_reflection: '', time_reflection: '', improve: '', quick_entry: '' })
  }, [user.id, journalKey, supabase])

  const fetchWeeklyReview = useCallback(async () => {
    const { data } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', reviewWeekKey)
      .single()
    setWeeklyReview(data || { went_well: '', didnt_go_well: '', focus_next_week: '' })
  }, [user.id, reviewWeekKey, supabase])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchJournal() }, [fetchJournal])
  useEffect(() => { fetchWeeklyReview() }, [fetchWeeklyReview])

  async function addTask(date: string, text: string, priority: string) {
    if (!text.trim()) return
    const { data } = await supabase
      .from('week_tasks')
      .insert({ user_id: user.id, text: text.trim(), done: false, date, priority })
      .select()
      .single()
    if (data) setAllTasks(prev => [...prev, data])
  }

  async function addTodayTask() {
    await addTask(todayKey, todayInput, todayPriority)
    setTodayInput('')
    setTodayPriority('P1')
  }

  async function addWeekTask(date: string) {
    const text = weekInputs[date] || ''
    const priority = weekPriorities[date] || 'P1'
    await addTask(date, text, priority)
    setWeekInputs(prev => ({ ...prev, [date]: '' }))
    setWeekPriorities(prev => ({ ...prev, [date]: 'P1' }))
  }

  async function toggleTask(id: string, done: boolean) {
    await supabase.from('week_tasks').update({ done: !done }).eq('id', id)
    setAllTasks(prev => prev.map(t => t.id === id ? { ...t, done: !done } : t))
  }

  async function deleteTask(id: string) {
    await supabase.from('week_tasks').delete().eq('id', id)
    setAllTasks(prev => prev.filter(t => t.id !== id))
  }

  async function addGoal() {
    if (!goalInput.trim()) return
    const { data } = await supabase
      .from('goals')
      .insert({ user_id: user.id, text: goalInput.trim(), timeframe: goalTimeframe, priority: goalPriority, completed: false })
      .select()
      .single()
    if (data) setGoals(prev => [...prev, data])
    setGoalInput('')
    setGoalPriority('P1')
  }

  async function completeGoal(id: string) {
    const completedAt = new Date().toISOString()
    await supabase.from('goals').update({ completed: true, completed_at: completedAt }).eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: true, completed_at: completedAt } : g))
  }

  async function uncompleteGoal(id: string) {
    await supabase.from('goals').update({ completed: false, completed_at: null }).eq('id', id)
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: false, completed_at: null } : g))
  }

  async function deleteGoal(id: string) {
    await supabase.from('goals').delete().eq('id', id)
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  async function saveJournal() {
    const hasContent = journalMode === 'quick'
      ? journal.quick_entry.trim().length > 0
      : [journal.wins, journal.tasks_reflection, journal.time_reflection, journal.improve].some(f => f.trim().length > 0)

    await supabase.from('journal_entries').upsert(
      { user_id: user.id, date: journalKey, ...journal },
      { onConflict: 'user_id,date' }
    )

    const todayStr = dateKey(new Date())
    if (journalKey === todayStr && hasContent) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = dateKey(yesterday)
      const isAlreadyCounted = streak.last_journal_date === todayStr
      if (!isAlreadyCounted) {
        const newStreak = streak.last_journal_date === yesterdayStr ? streak.current_streak + 1 : 1
        const newLongest = Math.max(newStreak, streak.longest_streak)
        const updatedStreak = { current_streak: newStreak, longest_streak: newLongest, last_journal_date: todayStr }
        await supabase.from('streaks').upsert(
          { user_id: user.id, ...updatedStreak, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        setStreak(updatedStreak)
      }
    }

    setSaveStatus(true)
    setTimeout(() => setSaveStatus(false), 2000)
  }

  async function saveWeeklyReview() {
    await supabase.from('weekly_reviews').upsert(
      { user_id: user.id, week_start: reviewWeekKey, ...weeklyReview },
      { onConflict: 'user_id,week_start' }
    )
    setWeekReviewSaveStatus(true)
    setTimeout(() => setWeekReviewSaveStatus(false), 2000)
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

        {/* Streak */}
        {streak.current_streak > 0 && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🔥</span>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>Current streak</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-syne)', color: 'var(--accent)' }}>
                  {streak.current_streak} {streak.current_streak === 1 ? 'day' : 'days'}
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🏆</span>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>Longest streak</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-syne)', color: 'var(--amber)' }}>
                  {streak.longest_streak} {streak.longest_streak === 1 ? 'day' : 'days'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '28px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '4px', flexWrap: 'wrap' }}>
          {['today', 'week', 'lists', 'maintenance', 'goals', 'journal', 'calendar'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '9px 10px', border: activeTab === tab ? '1px solid var(--border-hover)' : '1px solid transparent',
              borderRadius: '9px', background: activeTab === tab ? 'var(--bg4)' : 'transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--text3)', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s'
            }}>
              {tab === 'today' ? 'Today' : tab === 'week' ? 'This Week' : tab === 'lists' ? 'Lists' : tab === 'maintenance' ? 'Maintenance' : tab === 'goals' ? 'Big Goals' : tab === 'journal' ? 'Journal' : 'Calendar'}
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
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input value={todayInput} onChange={e => setTodayInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodayTask()}
              placeholder="Add a task for today..." style={{ flex: 1, minWidth: '160px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }} />
            <PrioritySelect value={todayPriority} onChange={setTodayPriority} />
            <button onClick={addTodayTask} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: '#fff', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}>+ Add</button>
          </div>
          <TaskList tasks={todayTasks} onToggle={toggleTask} onDelete={deleteTask} />
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
              const tasks = sortByPriority(allTasks.filter(t => t.date === dk))
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
                      <span style={{ color: 'var(--text3)', fontSize: '12px', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '10px 14px 12px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <input value={weekInputs[dk] || ''} onChange={e => setWeekInputs(prev => ({ ...prev, [dk]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addWeekTask(dk)} placeholder="Add task..."
                          style={{ flex: 1, minWidth: '120px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '0.82rem', outline: 'none' }} />
                        <PrioritySelect value={weekPriorities[dk] || 'P1'} onChange={v => setWeekPriorities(prev => ({ ...prev, [dk]: v }))} />
                        <button onClick={() => addWeekTask(dk)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '0.82rem', cursor: 'pointer' }}>+</button>
                      </div>
                      <TaskList tasks={tasks} onToggle={toggleTask} onDelete={deleteTask} />
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
              {activeGoals.length} active
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
            <PrioritySelect value={goalPriority} onChange={setGoalPriority} />
            <button onClick={addGoal} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: '#fff', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}>+ Add</button>
          </div>

          {activeGoals.length === 0
            ? <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text3)', fontSize: '0.85rem', border: '1px dashed var(--border)', borderRadius: '12px' }}>No active goals — what are you working towards?</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeGoals.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '13px 14px' }}
                  onMouseEnter={e => (e.currentTarget.querySelector('.del') as HTMLElement).style.opacity = '1'}
                  onMouseLeave={e => (e.currentTarget.querySelector('.del') as HTMLElement).style.opacity = '0'}>
                  <PriorityBadge priority={g.priority} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{g.text}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '3px' }}>{g.timeframe}</div>
                  </div>
                  <button onClick={() => completeGoal(g.id)} style={{ background: 'var(--green-dim)', border: '1px solid rgba(78,202,139,0.2)', borderRadius: '8px', padding: '4px 10px', color: 'var(--green)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>✓ Done</button>
                  <button className="del" onClick={() => deleteGoal(g.id)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', fontSize: '16px' }}>✕</button>
                </div>
              ))}
            </div>
          }

          {achievedGoals.length > 0 && (
            <div style={{ marginTop: '28px' }}>
              <div onClick={() => setShowAchieved(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '12px' }}>
                <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  🏆 {achievedGoals.length} achieved {showAchieved ? '▴' : '▾'}
                </span>
                <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
              </div>
              {showAchieved && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {achievedGoals.map(g => (
                    <div key={g.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '13px 14px', opacity: 0.6 }}
                      onMouseEnter={e => (e.currentTarget.querySelector('.del') as HTMLElement).style.opacity = '1'}
                      onMouseLeave={e => (e.currentTarget.querySelector('.del') as HTMLElement).style.opacity = '0'}>
                      <span style={{ fontSize: '14px', flexShrink: 0 }}>✓</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text)', textDecoration: 'line-through' }}>{g.text}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '3px' }}>
                          {g.completed_at ? `Completed ${new Date(g.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : g.timeframe}
                        </div>
                      </div>
                      <button onClick={() => uncompleteGoal(g.id)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 10px', color: 'var(--text3)', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Reopen</button>
                      <button className="del" onClick={() => deleteGoal(g.id)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', fontSize: '16px' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* JOURNAL */}
      {activeTab === 'journal' && (
        <div>
          {/* Daily Journal */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-syne)', fontSize: '1.1rem', fontWeight: 700 }}>Daily Journal</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>Reflect on your day</div>
            </div>
            <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px', gap: '3px' }}>
              {(['quick', 'deep'] as const).map(mode => (
                <button key={mode} onClick={() => setJournalMode(mode)} style={{
                  padding: '5px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500, transition: 'all 0.2s',
                  background: journalMode === mode ? 'var(--bg4)' : 'transparent',
                  color: journalMode === mode ? 'var(--text)' : 'var(--text3)',
                }}>
                  {mode === 'quick' ? 'Quick' : 'Deep'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => setJournalOffset(p => p - 1)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', cursor: 'pointer', padding: '6px 12px', fontSize: '14px' }}>←</button>
            <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-syne)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text2)' }}>{formatDisplay(journalDate)}</div>
            <button onClick={() => setJournalOffset(p => p + 1)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', cursor: 'pointer', padding: '6px 12px', fontSize: '14px' }}>→</button>
          </div>

          {journalMode === 'quick' && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-syne)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>How was your day?</div>
              <textarea value={journal.quick_entry} onChange={e => setJournal(prev => ({ ...prev, quick_entry: e.target.value }))}
                placeholder="Write anything — 2 lines or 2 pages, whatever feels right..." rows={6}
                style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px 14px', color: 'var(--text)', fontSize: '0.88rem', lineHeight: 1.7, resize: 'none', outline: 'none' }} />
            </div>
          )}

          {journalMode === 'deep' && (
            <>
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
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginBottom: '40px' }}>
            {saveStatus && <span style={{ fontSize: '0.78rem', color: 'var(--green)' }}>Saved ✓</span>}
            <button onClick={saveJournal} style={{ background: 'var(--bg3)', border: '1px solid var(--border-hover)', borderRadius: '8px', padding: '8px 20px', color: 'var(--text)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>Save Entry</button>
          </div>

          {/* Weekly Review */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
            <div
              onClick={() => setShowWeeklyReview(p => !p)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: showWeeklyReview ? '20px' : '0' }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-syne)', fontSize: '1.1rem', fontWeight: 700 }}>Weekly Review</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>Reflect on your week as a whole</div>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text3)', fontWeight: 500 }}>{showWeeklyReview ? '▴' : '▾'}</span>
            </div>

            {showWeeklyReview && (
              <>
                {/* Week navigation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <button onClick={() => setWeekReviewOffset(p => p - 1)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', cursor: 'pointer', padding: '6px 12px', fontSize: '14px' }}>←</button>
                  <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-syne)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text2)' }}>{formatWeekRange(reviewWeekStart)}</div>
                  <button onClick={() => setWeekReviewOffset(p => p + 1)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text2)', cursor: 'pointer', padding: '6px 12px', fontSize: '14px' }}>→</button>
                </div>

                {/* Week stats */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', flex: 1, minWidth: '120px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '4px', fontFamily: 'var(--font-syne)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tasks done</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-syne)', color: 'var(--text)' }}>{weekDoneCount}<span style={{ fontSize: '0.85rem', color: 'var(--text3)', fontWeight: 400 }}>/{weekTasksForReview.length}</span></div>
                  </div>
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', flex: 1, minWidth: '120px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '4px', fontFamily: 'var(--font-syne)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Completion</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-syne)', color: weekCompletionPct >= 80 ? 'var(--green)' : weekCompletionPct >= 50 ? 'var(--amber)' : 'var(--red)' }}>{weekCompletionPct}%</div>
                  </div>
                </div>

                {/* Review prompts */}
                {[
                  { key: 'went_well', label: 'What went well this week?' },
                  { key: 'didnt_go_well', label: "What didn't go well?" },
                  { key: 'focus_next_week', label: 'What will I focus on next week?' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-syne)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
                    <textarea value={weeklyReview[key as keyof WeeklyReview]} onChange={e => setWeeklyReview(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Write here..." rows={3}
                      style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px 14px', color: 'var(--text)', fontSize: '0.88rem', lineHeight: 1.7, resize: 'none', outline: 'none' }} />
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                  {weekReviewSaveStatus && <span style={{ fontSize: '0.78rem', color: 'var(--green)' }}>Saved ✓</span>}
                  <button onClick={saveWeeklyReview} style={{ background: 'var(--bg3)', border: '1px solid var(--border-hover)', borderRadius: '8px', padding: '8px 20px', color: 'var(--text)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>Save Review</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CALENDAR */}
      {activeTab === 'calendar' && <CalendarView user={user} />}

      {/* LISTS */}
      {activeTab === 'lists' && <ListsView user={user} />}

      {/* MAINTENANCE */}
      {activeTab === 'maintenance' && <MaintenanceView user={user} />}

    </div>
  )
}

function TaskList({ tasks, onToggle, onDelete }: { tasks: Task[], onToggle: (id: string, done: boolean) => void, onDelete: (id: string) => void }) {
  if (!tasks.length) return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)', fontSize: '0.82rem', border: '1px dashed var(--border)', borderRadius: '10px' }}>No tasks yet</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {tasks.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', opacity: t.done ? 0.45 : 1 }}
          onMouseEnter={e => (e.currentTarget.querySelector('.del') as HTMLElement).style.opacity = '1'}
          onMouseLeave={e => (e.currentTarget.querySelector('.del') as HTMLElement).style.opacity = '0'}>
          <div onClick={() => onToggle(t.id, t.done)} style={{ width: '18px', height: '18px', borderRadius: '50%', border: `1.5px solid ${t.done ? 'var(--green)' : 'var(--border-hover)'}`, background: t.done ? 'var(--green)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {t.done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <PriorityBadge priority={t.priority || 'P1'} />
          <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
          <button className="del" onClick={() => onDelete(t.id)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', fontSize: '16px' }}>✕</button>
        </div>
      ))}
    </div>
  )
}
