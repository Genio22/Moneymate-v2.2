import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LogOut, KeyRound, Save } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { authApi } from '../../services/auth'
import { humanize } from '../../services/api'
import { profileSchema } from '../../schemas'
import { initials } from '../../utils/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card, CardBody } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Input, Label } from '../../components/common/inputs'

export default function ProfileSettingsPage() {
  const { user, profile, refreshProfile, signOut, isSystemAdmin } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(profile?.full_name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  const saveProfile = async () => {
    const parsed = profileSchema.safeParse({ full_name: name, phone })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message)
      return
    }
    setSaving(true)
    try {
      await authApi.updateProfile(user.id, parsed.data)
      await refreshProfile()
      toast.success('Profile saved.')
    } catch (e) {
      toast.error(humanize(e))
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (pw1.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    if (pw1 !== pw2) {
      toast.error('Passwords do not match.')
      return
    }
    setPwBusy(true)
    try {
      await authApi.updatePassword(pw1)
      toast.success('Password updated.')
      setPw1('')
      setPw2('')
    } catch (e) {
      toast.error(humanize(e))
    } finally {
      setPwBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <PageHeader title="Profile & settings" subtitle={user?.email} />

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-lg font-bold">
              {initials(profile?.full_name || user?.email || '?')}
            </span>
            <div>
              <p className="text-sm font-semibold text-surface-900">{profile?.full_name || 'Unnamed'}</p>
              <p className="text-xs text-surface-400">{user?.email}</p>
              {isSystemAdmin && (
                <span className="mt-1 inline-block text-[10px] font-semibold text-white bg-purple-600 rounded-full px-2 py-0.5">
                  System administrator
                </span>
              )}
            </div>
          </div>
          <div>
            <Label required>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone || ''} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </div>
          <Button onClick={saveProfile} loading={saving}>
            <Save size={15} /> Save profile
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm font-semibold text-surface-900 flex items-center gap-2">
            <KeyRound size={15} className="text-surface-400" /> Change password
          </p>
          <Input type="password" placeholder="New password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
          <Input type="password" placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          <Button variant="secondary" onClick={changePassword} loading={pwBusy}>Update password</Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Button
            variant="danger"
            className="w-full"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
          >
            <LogOut size={15} /> Sign out
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
