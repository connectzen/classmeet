'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import { FolderOpen, Plus, X, Trash2, Pencil, Users, Search, Check } from 'lucide-react'
import PermissionGate from '@/components/layout/PermissionGate'
import { useToast } from '@/hooks/useToast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface GroupRow {
  id: string
  name: string
  description: string | null
  created_at: string
  memberCount: number
}

interface StudentOption {
  id: string
  name: string
  avatarUrl: string | null
}

// ── Create / Edit Group Modal ─────────────────────────────────────────────────
function GroupModal({ onClose, onSaved, students, existing }: {
  onClose: () => void
  onSaved: () => void
  students: StudentOption[]
  existing?: { id: string; name: string; description: string | null; memberIds: string[] }
}) {
  const user = useAppStore(s => s.user)
  const [name, setName] = useState(existing?.name || '')
  const [description, setDescription] = useState(existing?.description || '')
  const [selected, setSelected] = useState<Set<string>>(new Set(existing?.memberIds || []))
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !user?.id) return
    setLoading(true)

    const supabase = createClient()

    if (existing) {
      // Update group
      const { error: updateErr } = await supabase.from('groups').update({ name: name.trim(), description: description.trim() || null, updated_at: new Date().toISOString() }).eq('id', existing.id)
      if (updateErr) { console.error('Group update error:', updateErr); setLoading(false); return }
      // Sync members: delete removed, insert added
      const currentIds = existing.memberIds
      const newIds = Array.from(selected)
      const toRemove = currentIds.filter(id => !selected.has(id))
      const toAdd = newIds.filter(id => !currentIds.includes(id))

      if (toRemove.length > 0) {
        await supabase.from('group_members').delete().eq('group_id', existing.id).in('student_id', toRemove)
      }
      if (toAdd.length > 0) {
        await supabase.from('group_members').insert(toAdd.map(sid => ({ group_id: existing.id, student_id: sid })))
      }
    } else {
      // Create group
      const { data: group, error: insertErr } = await supabase.from('groups')
        .insert({ teacher_id: user.id, name: name.trim(), description: description.trim() || null })
        .select('id')
        .single()

      if (insertErr || !group) { console.error('Group create error:', insertErr); setLoading(false); return }

      if (selected.size > 0) {
        await supabase.from('group_members').insert(
          Array.from(selected).map(sid => ({ group_id: group.id, student_id: sid }))
        )
      }
    }

    setLoading(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-container" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
              {existing ? 'Edit Group' : 'Create Group'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {existing ? 'Update group details and members' : 'Name your group and select students'}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Group Name" required placeholder="e.g. Beginner English" value={name} onChange={e => setName(e.target.value)} />
          <div className="input-group">
            <label className="input-label">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <textarea className="input" rows={2} placeholder="What is this group for?" value={description} onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical', minHeight: '60px' }} />
          </div>

          {/* Student selection */}
          <div>
            <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>
              Select Students <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({selected.size} selected)</span>
            </label>
            <Input placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)} leftIcon={<Search size={14} />} />
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {students.length === 0 ? 'No students enrolled yet' : 'No matching students'}
                </div>
              ) : (
                filtered.map(s => (
                  <div
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                      cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                      background: selected.has(s.id) ? 'rgba(99,102,241,0.08)' : 'transparent',
                    }}
                    role="checkbox"
                    aria-checked={selected.has(s.id)}
                    tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggle(s.id)}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 'var(--radius-sm)',
                      border: selected.has(s.id) ? 'none' : '2px solid var(--border-primary)',
                      background: selected.has(s.id) ? 'var(--primary-500)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {selected.has(s.id) && <Check size={12} color="#fff" />}
                    </div>
                    <Avatar src={s.avatarUrl} name={s.name} size="xs" />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{s.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading} icon={existing ? <Pencil size={14} /> : <Plus size={14} />}>
              {existing ? 'Save Changes' : 'Create Group'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Group Card ────────────────────────────────────────────────────────────────
function GroupCard({ group, onEdit, onDelete }: {
  group: GroupRow
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{group.name}</h3>
          {group.description && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{group.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit} aria-label="Edit"><Pencil size={14} /></button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete} aria-label="Delete" style={{ color: 'var(--danger-400)' }}><Trash2 size={14} /></button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <Users size={14} />
        <span>{group.memberCount} {group.memberCount === 1 ? 'student' : 'students'}</span>
        <span style={{ margin: '0 6px' }}>·</span>
        <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
function GroupsPageInner() {
  const user = useAppStore(s => s.user)
  const { toast, show: showToast } = useToast()
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editGroup, setEditGroup] = useState<{ id: string; name: string; description: string | null; memberIds: string[] } | undefined>()

  const loadGroups = useCallback(async () => {
    if (!user?.id) return
    const supabase = createClient()
    const { data: groupsData } = await supabase
      .from('groups')
      .select('id, name, description, created_at')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })

    if (groupsData) {
      // Batch: single query for all member rows, count in JS — avoids N+1
      const groupIds = groupsData.map(g => g.id)
      const { data: allMembers } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds)

      const countMap = new Map<string, number>()
      for (const m of allMembers ?? []) {
        countMap.set(m.group_id, (countMap.get(m.group_id) ?? 0) + 1)
      }

      setGroups(groupsData.map(g => ({ ...g, memberCount: countMap.get(g.id) ?? 0 })))
    }
    setLoading(false)
  }, [user?.id])

  const loadStudents = useCallback(async () => {
    if (!user?.id) return
    const supabase = createClient()
    const { data: enrollments } = await supabase
      .from('teacher_students')
      .select('student_id')
      .eq('teacher_id', user.id)

    if (enrollments && enrollments.length > 0) {
      const ids = enrollments.map(e => e.student_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids)
      if (profiles) {
        setStudents(profiles.map(p => ({ id: p.id, name: p.full_name || 'Student', avatarUrl: p.avatar_url })))
      }
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    loadGroups()
    loadStudents()

    const supabase = createClient()
    const channel = supabase
      .channel('groups-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => loadGroups())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => loadGroups())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, loadGroups, loadStudents])

  async function handleEdit(group: GroupRow) {
    const supabase = createClient()
    const { data: members } = await supabase
      .from('group_members')
      .select('student_id')
      .eq('group_id', group.id)
    const memberIds = members?.map(m => m.student_id) || []
    setEditGroup({ id: group.id, name: group.name, description: group.description, memberIds })
    setShowModal(true)
  }

  async function handleDelete(group: GroupRow) {
    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return
    const supabase = createClient()
    await supabase.from('groups').delete().eq('id', group.id)
    setGroups(prev => prev.filter(g => g.id !== group.id))
    showToast(`✅ "${group.name}" deleted`)
  }

  function handleCreate() {
    setEditGroup(undefined)
    setShowModal(true)
  }

  function handleSaved() {
    loadGroups()
    showToast(editGroup ? '✅ Group updated' : '✅ Group created')
  }

  return (
    <div style={{ maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Groups</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Organize your students into groups for targeted sessions
          </p>
        </div>
        <Button icon={<Plus size={15} />} onClick={handleCreate}>Create Group</Button>
      </div>

      {/* Groups grid */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading groups…</p>
        </div>
      ) : groups.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {groups.map(group => (
            <GroupCard key={group.id} group={group} onEdit={() => handleEdit(group)} onDelete={() => handleDelete(group)} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <FolderOpen size={28} color="var(--primary-400)" />
          </div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>No groups yet</h3>
          <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto' }}>
            Create groups to organize your students — e.g. &quot;Beginner English&quot;, &quot;Advanced Writing&quot;, &quot;Weekend Class&quot;.
          </p>
          <Button icon={<Plus size={15} />} onClick={handleCreate}>Create Your First Group</Button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <GroupModal
          onClose={() => { setShowModal(false); setEditGroup(undefined) }}
          onSaved={handleSaved}
          students={students}
          existing={editGroup}
        />
      )}

      {toast && <div className="toast toast-success" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}

export default function GroupsPage() {
  return (
    <PermissionGate permission="create_groups">
      <GroupsPageInner />
    </PermissionGate>
  )
}
