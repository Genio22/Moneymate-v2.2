import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { HandCoins } from 'lucide-react'
import { advanceSchema } from '../../schemas'
import { advancesApi } from '../../services/advances'
import { projectsApi } from '../../services/projects'
import { useAuth } from '../../contexts/AuthContext'
import { formatBDT } from '../../utils/money'
import { todayISO } from '../../utils/format'
import { Button } from '../common/Button'
import { Input, Label, Select, Textarea, AmountInput } from '../common/inputs'
import { Modal } from '../common/Modal'
import { parseTakaToPoisha } from '../../utils/money'

/**
 * Record money moving from a provider to a custodian ("senior gives junior ৳500").
 */
export function AdvanceForm({ projectId, open, onClose, onSaved, defaultCustodianId }) {
  const { user, profile } = useAuth()
  const [members, setMembers] = useState([])
  const [error, setError] = useState(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(advanceSchema),
    defaultValues: {
      provider_mode: 'self',
      provider_user_id: '',
      provider_name: '',
      custodian_id: defaultCustodianId || '',
      amount: '',
      funding_source: 'own_funds',
      purpose: '',
      provided_on: todayISO(),
    },
  })

  const values = watch()

  useEffect(() => {
    projectsApi.members(projectId).then(setMembers).catch(() => {})
  }, [projectId])

  const onSubmit = async (data) => {
    setError(null)
    try {
      const providerUserId = data.provider_mode === 'self' ? user.id : data.provider_mode === 'member' ? data.provider_user_id : null
      await advancesApi.create({ ...data, provider_user_id: providerUserId }, projectId)
      toast.success('Advance recorded. The receiver has been notified to confirm it.')
      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record an advance" subtitle="Money handed to a member for future spending">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label required>Who gave the money?</Label>
          <Select {...register('provider_mode')}>
            <option value="self">I did</option>
            <option value="member">Another team member</option>
            <option value="external">Someone outside the team (sponsor, org…)</option>
          </Select>
        </div>
        {values.provider_mode === 'member' && (
          <div>
            <Label required>Which member?</Label>
            <Select {...register('provider_user_id')} error={errors.provider_user_id?.message}>
              <option value="">Select member…</option>
              {members.filter((m) => m.user?.id !== user?.id).map((m) => (
                <option key={m.id} value={m.user.id}>{m.user.full_name}</option>
              ))}
            </Select>
          </div>
        )}
        {values.provider_mode === 'external' && (
          <div>
            <Label required>Provider name</Label>
            <Input placeholder="e.g. Sponsor A" error={errors.provider_name?.message} {...register('provider_name')} />
          </div>
        )}

        <div>
          <Label required>Who will hold the money?</Label>
          <Select {...register('custodian_id')} error={errors.custodian_id?.message}>
            <option value="">Select member…</option>
            {members.map((m) => (
              <option key={m.id} value={m.user.id}>
                {m.user.full_name}{m.user.id === user?.id ? ' (me)' : ''}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label required>Amount</Label>
            <AmountInput placeholder="0.00" error={errors.amount?.message} {...register('amount')} />
          </div>
          <div>
            <Label required>Date</Label>
            <Input type="date" error={errors.provided_on?.message} {...register('provided_on')} />
          </div>
        </div>

        <div>
          <Label required>Where is this money from?</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { value: 'own_funds', label: "Provider's own money", hint: 'New money entering the project' },
              { value: 'project_cash', label: 'Project cash', hint: 'Drawn from funds already recorded' },
            ].map((o) => (
              <label key={o.value} className="flex items-start gap-2 rounded-xl border border-surface-200 p-3 cursor-pointer hover:bg-surface-50">
                <input type="radio" value={o.value} className="mt-0.5 h-4 w-4 text-primary-600 focus:ring-primary-500" {...register('funding_source')} />
                <span>
                  <span className="block text-sm font-medium text-surface-800">{o.label}</span>
                  <span className="block text-[11px] text-surface-500">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label>Purpose</Label>
          <Textarea rows={2} placeholder="e.g. decoration purchases" {...register('purpose')} />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Record advance</Button>
        </div>
      </form>
    </Modal>
  )
}
