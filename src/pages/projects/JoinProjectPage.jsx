import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Landmark, Mail, CheckCircle2 } from 'lucide-react'
import { projectsApi } from '../../services/projects'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card, CardBody } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Input, Label } from '../../components/common/inputs'
import { DataState } from '../../components/common/DataState'
import { formatDate, titleCase } from '../../utils/format'

/** Join a project by invite code or accept an email invitation. */
export default function JoinProjectPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [code, setCode] = useState(params.get('code') || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [invitations, setInvitations] = useState(null)

  useEffect(() => {
    projectsApi
      .myPendingInvitations()
      .then(setInvitations)
      .catch(() => setInvitations([]))
  }, [])

  const joinByCode = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const projectId = await projectsApi.joinByCode(code)
      toast.success('Joined! Welcome aboard.')
      navigate(`/app/projects/${projectId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const accept = async (inv) => {
    try {
      const projectId = await projectsApi.acceptInvitation(inv.id)
      toast.success(`You joined ${inv.project?.name}.`)
      navigate(`/app/projects/${projectId}`)
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader title="Join a project" subtitle="Have a code or an invitation? Get in here." backTo="/app" />

      <Card className="mb-4">
        <CardBody>
          <form onSubmit={joinByCode} className="space-y-3">
            <div>
              <Label required>Invite code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. a1b2c3d4e5"
                autoCapitalize="none"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" className="w-full" loading={busy} disabled={!code.trim()}>
              <Landmark size={16} /> Join with code
            </Button>
          </form>
        </CardBody>
      </Card>

      <DataState loading={invitations === null} empty={invitations?.length === 0} emptyTitle="No pending invitations" emptyHint="Ask a project manager to invite your email, or use an invite code above.">
        <h2 className="text-sm font-semibold text-surface-900 mb-2 flex items-center gap-2">
          <Mail size={15} className="text-primary-600" /> Invitations for you
        </h2>
        <div className="space-y-2.5">
          {invitations?.map((inv) => (
            <Card key={inv.id}>
              <CardBody className="flex items-center gap-3 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-surface-900 truncate">{inv.project?.name}</p>
                  <p className="text-[11px] text-surface-400">
                    as {titleCase(inv.role)} · expires {formatDate(inv.expires_at)}
                  </p>
                </div>
                <Button size="sm" onClick={() => accept(inv)}>
                  <CheckCircle2 size={14} /> Accept
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      </DataState>
    </div>
  )
}
