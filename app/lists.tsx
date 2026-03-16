'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

type List = { id: string; name: string }
type ListItem = { id: string; list_id: string; text: string; done: boolean }

export default function ListsView({ user }: { user: User }) {
  const supabase = createClient()

  const [lists, setLists] = useState<List[]>([])
  const [items, setItems] = useState<ListItem[]>([])
  const [activeList, setActiveList] = useState<string | null>(null)
  const [newListName, setNewListName] = useState('')
  const [newItemText, setNewItemText] = useState('')
  const [showNewList, setShowNewList] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const [l, i] = await Promise.all([
      supabase.from('lists').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('list_items').select('*').eq('user_id', user.id).order('created_at'),
    ])
    const fetchedLists = l.data || []
    setLists(fetchedLists)
    setItems(i.data || [])
    if (fetchedLists.length > 0 && !activeList) {
      setActiveList(fetchedLists[0].id)
    }
    setLoading(false)
  }, [user.id, supabase, activeList])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function createList() {
    if (!newListName.trim()) return
    const { data } = await supabase
      .from('lists')
      .insert({ user_id: user.id, name: newListName.trim() })
      .select()
      .single()
    if (data) {
      setLists(prev => [...prev, data])
      setActiveList(data.id)
    }
    setNewListName('')
    setShowNewList(false)
  }

  async function deleteList(id: string) {
    await supabase.from('lists').delete().eq('id', id)
    setLists(prev => prev.filter(l => l.id !== id))
    setItems(prev => prev.filter(i => i.list_id !== id))
    if (activeList === id) {
      const remaining = lists.filter(l => l.id !== id)
      setActiveList(remaining.length > 0 ? remaining[0].id : null)
    }
  }

  async function addItem() {
    if (!newItemText.trim() || !activeList) return
    const { data } = await supabase
      .from('list_items')
      .insert({ user_id: user.id, list_id: activeList, text: newItemText.trim(), done: false })
      .select()
      .single()
    if (data) setItems(prev => [...prev, data])
    setNewItemText('')
  }

  async function toggleItem(id: string, done: boolean) {
    await supabase.from('list_items').update({ done: !done }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: !done } : i))
  }

  async function deleteItem(id: string) {
    await supabase.from('list_items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const activeItems = items.filter(i => i.list_id === activeList)
  const doneCount = activeItems.filter(i => i.done).length
  const activeListName = lists.find(l => l.id === activeList)?.name || ''

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: '0.9rem' }}>Loading...</div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-syne)', fontSize: '1.1rem', fontWeight: 700 }}>Someday Lists</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text3)', marginTop: '2px' }}>Things to do eventually — no pressure, no dates</div>
        </div>
        <button onClick={() => setShowNewList(true)} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '8px 14px', color: '#fff', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer' }}>
          + New List
        </button>
      </div>

      {/* New list input */}
      {showNewList && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createList(); if (e.key === 'Escape') setShowNewList(false) }}
            placeholder="List name e.g. Home Fixes, Errands..."
            autoFocus
            style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--accent)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
          />
          <button onClick={createList} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: '#fff', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}>Create</button>
          <button onClick={() => setShowNewList(false)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text3)', fontSize: '0.88rem', cursor: 'pointer' }}>Cancel</button>
        </div>
      )}

      {lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text3)', fontSize: '0.85rem', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          No lists yet — create one to start capturing things you want to do someday
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

          {/* List sidebar */}
          <div style={{ width: '200px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {lists.map(l => {
              const count = items.filter(i => i.list_id === l.id).length
              const done = items.filter(i => i.list_id === l.id && i.done).length
              const isActive = l.id === activeList
              return (
                <div key={l.id}
                  onClick={() => setActiveList(l.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                    background: isActive ? 'var(--bg4)' : 'var(--bg2)',
                    border: `1px solid ${isActive ? 'var(--border-hover)' : 'var(--border)'}`,
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => (e.currentTarget.querySelector('.list-del') as HTMLElement).style.opacity = '1'}
                  onMouseLeave={e => (e.currentTarget.querySelector('.list-del') as HTMLElement).style.opacity = '0'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: isActive ? 'var(--text)' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                    {count > 0 && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: '2px' }}>{done}/{count} done</div>
                    )}
                  </div>
                  <button
                    className="list-del"
                    onClick={e => { e.stopPropagation(); deleteList(l.id) }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', fontSize: '14px', flexShrink: 0, marginLeft: '4px' }}
                  >✕</button>
                </div>
              )
            })}
          </div>

          {/* List items */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-syne)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{activeListName}</div>
                {activeItems.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: '2px' }}>{doneCount} of {activeItems.length} done</div>
                )}
              </div>
              {activeItems.length > 0 && (
                <span style={{ fontSize: '0.72rem', fontWeight: 500, padding: '3px 10px', borderRadius: '20px', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(124,106,245,0.2)' }}>
                  {activeItems.length} {activeItems.length === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="Add an item..."
                style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
              />
              <button onClick={addItem} style={{ background: 'var(--accent)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: '#fff', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}>+ Add</button>
            </div>

            {activeItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text3)', fontSize: '0.82rem', border: '1px dashed var(--border)', borderRadius: '10px' }}>
                No items yet — add something you want to do someday
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeItems.map(item => (
                  <div key={item.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '11px 14px', opacity: item.done ? 0.45 : 1 }}
                    onMouseEnter={e => (e.currentTarget.querySelector('.item-del') as HTMLElement).style.opacity = '1'}
                    onMouseLeave={e => (e.currentTarget.querySelector('.item-del') as HTMLElement).style.opacity = '0'}
                  >
                    <div onClick={() => toggleItem(item.id, item.done)} style={{ width: '18px', height: '18px', borderRadius: '50%', border: `1.5px solid ${item.done ? 'var(--green)' : 'var(--border-hover)'}`, background: item.done ? 'var(--green)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#0a0a0f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                    <button className="item-del" onClick={() => deleteItem(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s', fontSize: '16px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}