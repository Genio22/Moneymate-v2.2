import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { resourceSchema } from '../../schemas'
import { resourcesApi } from '../../services/resources'
import { projectsApi } from '../../services/projects'
import { contributionsApi } from '../../services/contributions'
import { useAuth } from '../../contexts/AuthContext'
import { RESOURCE_STATUSES, OWNERSHIP_STATUSES } from '../../constants'
import { titleCase, todayISO } from '../../utils/format'
import { Button } from '../common/Button'
import { Input, Label, Select, Textarea, AmountInput } from '../common/inputs'
import { Modal } from '../common/Modal'

export function ResourceForm({ projectId, open, onClose, onSaved }) {
  const { user, profile } = useAuth()
  const [members, setMembers] = useState([])
  const [assetContributions, setAssetContributions] = useState([])
  const [error, setError] = useState(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      name: '',
      resource_type: 'asset',
      description: '',
      owner_mode: 'self',
      owner_user_id: '',
      owner_name: '',
      ownership_status: 'contributor_retained',
      quantity: '1',
      unit: '',
      agreed_value: '',
      custodian_id: '',
      location: '',
      status: 'available',
      returnable: true,
      usage_start: '',
      usage_end: '',
      usage_conditions: '',
      source_contribution_id: '',
    },
  })

  const values = watch()

  useEffect(() => {
    projectsApi.members(projectId).then(setMembers).catch(() => {})
    contributionsApi.list(projectId, { type: 'asset' }).then(setAssetContributions).catch(() => {})
  }, [projectId])

  const memberOptions = members.filter((m) => m.user)
  const ownerNameFor = (mode, id) => {
    if (mode === 'self') return profile?.full_name || ''
    const m = memberOptions.find((x) => x.user?.id === id)
    return m?.user?.full_name || ''
  }

  const onSubmit = async (data) => {
    setError(null)
    try {
      await resourcesApi.create(
        { ...data, owner_display_name: ownerNameFor(data.owner_mode, data.owner_user_id) },
        projectId,
        user.id,
      )
      toast.success('Resource added.')
      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add resource" subtitle="Materials, assets or facility access being tracked">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label required>Resource name</Label>
            <Input placeholder="e.g. Canon EOS 750D" error={errors.name?.message} {...register('name')} />
          </div>
          <div>
            <Label required>Type</Label>
            <Select {...register('resource_type')}>
              <option value="material">Material</option>
              <option value="asset">Physical asset</option>
              <option value="access">Access / facility</option>
              <option value="other">Other</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <Textarea rows={2} placeholder="Condition, accessories, serial number…" {...register('description')} />
        </div>

        <div>
          <Label required>Owner (who does it belong to?)</Label>
          <Select {...register('owner_mode')}>
            <option value="self">Me</option>
            <option value="member">A team member</option>
            <option value="external">Someone outside the team</option>
          </Select>
        </div>
        {values.owner_mode === 'member' && (
          <div>
            <Label required>Which member?</Label>
            <Select {...register('owner_user_id')} error={errors.owner_user_id?.message}>
              <option value="">Select member…</option>
              {memberOptions.map((m) => <option key={m.id} value={m.user.id}>{m.user.full_name}</option>)}
            </Select>
          </div>
        )}
        {values.owner_mode === 'external' && (
          <div>
            <Label required>Owner name</Label>
            <Input placeholder="e.g. ABC Studio" error={errors.owner_name?.message} {...register('owner_name')} />
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Ownership</Label>
            <Select {...register('ownership_status')}>
              {OWNERSHIP_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div>
            <Label>Agreed value (৳)</Label>
            <AmountInput placeholder="Optional" error={errors.agreed_value?.message} {...register('agreed_value')} />
          </div>
          <div>
            <Label>Status</Label>
            <Select {...register('status')}>
              {RESOURCE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Quantity</Label>
            <Input inputMode="decimal" placeholder="1" {...register('quantity')} />
          </div>
          <div>
            <Label>Unit</Label>
            <Input placeholder="pcs, sets…" {...register('unit')} />
          </div>
          <div>
            <Label>Current custodian</Label>
            <Select {...register('custodian_id')}>
              <option value="">Nobody / with owner</option>
              {memberOptions.map((m) => <option key={m.id} value={m.user.id}>{m.user.full_name}</option>)}
            </Select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Location</Label>
            <Input placeholder="Where is it now?" {...register('location')} />
          </div>
          <label className="flex items-center gap-2.5 h-10 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500" {...register('returnable')} />
            <span className="text-sm text-surface-700">Returnable to owner</span>
          </label>
        </div>

        {assetContributions.length > 0 && (
          <div>
            <Label>Linked contribution</Label>
            <Select {...register('source_contribution_id')}>
              <option value="">Not linked</option>
              {assetContributions.map((c) => <option key={c.id} value={c.id}>{c.title} — {c.contributor_name}</option>)}
            </Select>
          </div>
        )}

        <div>
          <Label>Notes</Label>
          <Textarea rows={2} placeholder="Usage arrangements…" {...register('usage_conditions')} />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Add resource</Button>
        </div>
      </form>
    </Modal>
  )
}
