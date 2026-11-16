import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, Copy, Check, Trash2, Users } from 'lucide-react'
import { projectsApi } from '../../../services/projects'
import { inviteSchema } from '../../../schemas'
import { useProject } from '../../../hooks/useProject'
import { useAuth } from '../../../contexts/AuthContext'
import { initials, formatDate, titleCase } from '../../../utils/format'
import { PageHeader } from '../../../components/layout/PageHeader'
import { DataState } from '../../../components/common/DataState'
import { Badge } from '../../../components/common/Badge'
import { Card, CardBody } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { Input, Label, Select } from '../../../components/common/inputs'
import { Modal, ConfirmDialog } from '../../../components/common/Modal'

export default function MembersTab() {
  const { projectId, project, isManager, members, refresh } = useProject()
  const { user } = useAuth()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invitations, setInvitations] = useState([])
  const [removeTarget, setRemoveTarget] = useState(null)
  const [copied, setCopied] = useState(false)

  const loadInvitations = useCallback(async () => {
    try {
      setInvitations(await projectsApi.listInvitations(projectId))
    } catch { /* ignore */ }
  }, [projectId])

  useEffect(() => {
    loadInvitations()
  }, [loadInvitations])

  const setRole = async (member, role) => {
    try {
      await projectsApi.setMemberRole(member.id, role)
      toast.success(`${member.user.full_name} is now a ${role}.`)
      refresh()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const removeMember = async () => {
    if (!removeTarget) return
    try {
      await projectsApi.removeMember(removeTarget.id)
      toast.success(`${removeTarget.user.full_name} removed.`)
      setRemoveTarget(null)
      refresh()
    } catch (e) {
      toast.error(e.message)
      setRemoveTarget(null)
    }
  }

  const copyInvite = async () => {
    const link = `${window.location.origin}/app/join?code=${project.invite_code}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Invite link copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — copy manually: ' + link)
    }
  }

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${members.length} members · roles decide who can verify and manage`}
        action={isManager && <Button size="md" onClick={() => setInviteOpen(true)}><UserPlus size={16} /> Invite</Button>}
      />

      <Card className="mb-4">
        <CardBody className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-800">Invite with a link</p>
            <p className="text-xs text-surface-500 mt-0.5 break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/app/join?code=${project.invite_code}` : ''}
            </p>
          </div>
          <Button variant="secondary" onClick={copyInvite}>
            {copied ? <Check size={15} className="text-accent-600" /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </CardBody>
      </Card>

      <DataState loading={false} empty={members.length === 0} emptyTitle="No members">
        <div className="space-y-2.5">
          {members.map((m) => {
            const isOwner = m.user?.id === project.owner_id
            return (
              <Card key={m.id}>
                <CardBody className="flex items-center gap-3 py-3">
                  <span className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {initials(m.user?.full_name || '?')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-surface-900 truncate">
                      {m.user?.full_name || 'Unnamed'}
                      {m.user?.id === user?.id && <span className="text-surface-400 font-normal"> (you)</span>}
                    </p>
                    <p className="text-xs text-surface-400">joined {formatDate(m.joined_at)}</p>
                  </div>
                  {isOwner && <Badge value="manager">Owner</Badge>}
                  {!isOwner && isManager ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={m.role}
                        onChange={(e) => setRole(m, e.target.value)}
                        disabled={m.user?.id === user?.id}
                        className="h-8 w-28 text-xs"
                      >
                        <option value="manager">Manager</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </Select>
                      {m.user?.id !== user?.id && (
                        <button
                          onClick={() => setRemoveTarget(m)}
                          className="p-2 rounded-lg text-surface-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          aria-label={`Remove ${m.user?.full_name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <Badge value={m.role} />
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      </DataState>

      {invitations.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-semibold text-surface-900 mb-2">Pending invitations</h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5">
                <div>
                  <p className="text-sm text-surface-800">{inv.email}</p>
                  <p className="text-[11px] text-surface-400">
                    {titleCase(inv.role)} · {titleCase(inv.status)} · expires {formatDate(inv.expires_at)}
                  </p>
                </div>
                {isManager && inv.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await projectsApi.revokeInvitation(inv.id)
                        toast.success('Invitation revoked.')
                        loadInvitations()
                      } catch (e) {
                        toast.error(e.message)
                      }
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <InviteModal
        projectId={projectId}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSaved={() => {
          setInviteOpen(false)
          loadInvitations()
        }}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeMember}
        title="Remove member?"
        message={`${removeTarget?.user?.full_name} will lose access to this project.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  )
}

function InviteModal({ projectId, open, onClose, onSaved }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const parsed = inviteSchema.safeParse({ email, role })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await projectsApi.inviteMember(projectId, parsed.data.email, parsed.data.role)
      toast.success(`Invitation saved for ${email}. They can accept it from the Join page after logging in.`)
      setEmail('')
      onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite a member" subtitle="They'll be able to accept from their Join page" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label required>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="member@example.com" />
        </div>
        <div>
          <Label required>Role</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">Member — record transactions</option>
            <option value="manager">Manager — verify claims & manage</option>
            <option value="viewer">Viewer — read only</option>
          </Select>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}><Users size={15} /> Send invitation</Button>
        </div>
      </form>
    </Modal>
  )
}
