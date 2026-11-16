import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { Banknote, Package, Boxes as AssetIcon, Home, User, Users, Building2, Info } from 'lucide-react'
import { contributionSchema } from '../../schemas'
import { contributionsApi } from '../../services/contributions'
import { projectsApi } from '../../services/projects'
import { uploadReceipts } from '../../services/storage'
import { humanize } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { parseTakaToPoisha } from '../../utils/money'
import { CONTRIBUTION_TYPES, OWNERSHIP_STATUSES } from '../../constants'
import { titleCase, todayISO } from '../../utils/format'
import { Button } from '../common/Button'
import { Input, Label, Select, Textarea, AmountInput } from '../common/inputs'
import { FileUpload } from '../forms/FileUpload'
import clsx from 'clsx'

const TYPE_ICONS = { cash: Banknote, material: Package, asset: AssetIcon, in_kind: Home }

/** Contributor picker values: 'self' | 'member:<id>' | 'external' */
function toContributorMode(v) {
  if (v === 'self') return { mode: 'self' }
  if (v === 'external') return { mode: 'external' }
  return { mode: 'member', id: v.replace('member:', '') }
}

export function ContributionForm({ projectId, existing = null, onDone }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [files, setFiles] = useState([])
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const editing = Boolean(existing)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(contributionSchema),
    defaultValues: existing
      ? {
          contribution_type: existing.contribution_type,
          contributor_mode: existing.contributor_user_id ? `member:${existing.contributor_user_id}` : 'external',
          contributor_name: existing.contributor_name,
          title: existing.title,
          description: existing.description || '',
          amount: String(existing.amount_poisha / 100),
          received_on: existing.received_on,
          quantity: String(existing.quantity ?? 1),
          unit: existing.unit || '',
          location: existing.location || '',
          ownership_status: existing.ownership_status,
          usage_start: existing.usage_start || '',
          usage_end: existing.usage_end || '',
          usage_conditions: existing.usage_conditions || '',
          restricted: existing.restricted,
        }
      : {
          contribution_type: 'cash',
          contributor_mode: 'self',
          contributor_name: '',
          title: '',
          description: '',
          amount: '',
          received_on: todayISO(),
          quantity: '1',
          unit: '',
          location: '',
          ownership_status: 'undetermined',
          usage_start: '',
          usage_end: '',
          usage_conditions: '',
          restricted: false,
        },
  })

  const values = watch()
  const type = values.contribution_type
  const isNonCash = type !== 'cash'

  useEffect(() => {
    projectsApi.members(projectId).then(setMembers).catch(() => {})
  }, [projectId])

  // Keep contributor_name in sync with the picker
  useEffect(() => {
    const m = members.find((x) => `member:${x.user?.id}` === values.contributor_mode)
    if (m) setValue('contributor_name', m.user.full_name || '')
  }, [members, values.contributor_mode, setValue])

  const amountLabel = useMemo(() => {
    if (type === 'cash') return 'How much money was received?'
    if (type === 'in_kind') return 'Agreed value of this access (optional estimate)'
    return 'Agreed monetary value (what it would have cost the project)'
  }, [type])

  const onSubmit = async (data) => {
    setSubmitError(null)
    setSubmitting(true)
    try {
      const { mode, id } = toContributorMode(values.contributor_mode)
      let contributorName = data.contributor_name?.trim()
      if (mode === 'self') contributorName = profile?.full_name || contributorName

      const payload = {
        project_id: projectId,
        ...data,
        contributor_mode: mode,
        contributor_user_id: mode === 'member' ? id : mode === 'self' ? user.id : null,
        contributor_name: contributorName,
      }

      const contribution = editing
        ? await contributionsApi.update(existing.id, {
            title: payload.title,
            description: payload.description || null,
            amount_poisha: parseTakaToPoisha(data.amount),
            received_on: payload.received_on,
            location: payload.location || null,
            usage_conditions: payload.usage_conditions || null,
          })
        : await contributionsApi.create(payload, user.id)

      if (files.length) {
        try {
          await uploadReceipts(projectId, 'contribution', contribution.id, files)
        } catch (e) {
          toast.error(`Contribution saved, but evidence upload failed: ${humanize(e)}`)
        }
      }
      toast.success(
        editing
          ? 'Contribution updated.'
          : type === 'cash'
            ? 'Contribution recorded — pending verification.'
            : 'Contribution recorded. Its value will not be added to project cash.',
      )
      onDone?.(contribution)
      if (!editing) navigate(`/app/projects/${projectId}/contributions/${contribution.id}`)
    } catch (e) {
      setSubmitError(humanize(e))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Type picker */}
      {!editing && (
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 sm:p-5">
          <Label required>What kind of contribution is this?</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CONTRIBUTION_TYPES.map((t) => {
              const Icon = TYPE_ICONS[t.value]
              const active = type === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setValue('contribution_type', t.value)}
                  className={clsx(
                    'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition',
                    active ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-surface-200 hover:border-surface-300',
                  )}
                >
                  <Icon size={17} className={active ? 'text-primary-700' : 'text-surface-500'} />
                  <span className={clsx('text-sm font-semibold', active ? 'text-primary-800' : 'text-surface-800')}>{t.label}</span>
                  <span className="text-[10px] text-surface-500 leading-snug">{t.hint}</span>
                </button>
              )
            })}
          </div>
          {isNonCash && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30 px-3 py-2.5">
              <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-blue-800">
                The agreed value is tracked for reporting only — it will <b>never</b> be added to the project's available cash.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Who & what */}
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 sm:p-5 space-y-4">
        <div>
          <Label required>Who provided it?</Label>
          <Select {...register('contributor_mode')} defaultValue={values.contributor_mode}>
            <option value="self">Me</option>
            {members.filter((m) => m.user?.id !== user?.id).map((m) => (
              <option key={m.id} value={`member:${m.user.id}`}>{m.user.full_name}</option>
            ))}
            <option value="external">Someone outside the team (sponsor, org…)</option>
          </Select>
        </div>
        <div>
          <Label required hint="appears in reports">Contributor name</Label>
          <Input placeholder="e.g. Sponsor A, Rahim Ahmed, ABC Foundation" error={errors.contributor_name?.message} {...register('contributor_name')} />
        </div>
        <div>
          <Label required>Short title</Label>
          <Input placeholder={type === 'cash' ? 'e.g. Sponsor A — equipment fund' : 'e.g. 20 cans of paint, Canon camera'} error={errors.title?.message} {...register('title')} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={2} placeholder="Optional details…" {...register('description')} />
        </div>
      </div>

      {/* Value & date */}
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 sm:p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label required>{amountLabel}</Label>
            <AmountInput placeholder="0.00" error={errors.amount?.message} {...register('amount')} />
          </div>
          <div>
            <Label required>Date received / started</Label>
            <Input type="date" error={errors.received_on?.message} {...register('received_on')} />
          </div>
        </div>

        {isNonCash && type !== 'in_kind' && (
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Quantity</Label>
              <Input inputMode="decimal" placeholder="1" {...register('quantity')} />
            </div>
            <div>
              <Label>Unit</Label>
              <Input placeholder="pcs, cans, sets…" {...register('unit')} />
            </div>
            <div>
              <Label>Ownership</Label>
              <Select {...register('ownership_status')}>
                {OWNERSHIP_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          </div>
        )}

        {type === 'in_kind' && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label required>Access starts</Label>
                <Input type="date" error={errors.usage_start?.message} {...register('usage_start')} />
              </div>
              <div>
                <Label required>Access ends</Label>
                <Input type="date" error={errors.usage_end?.message} {...register('usage_end')} />
              </div>
            </div>
            <div>
              <Label>Usage conditions</Label>
              <Textarea rows={2} placeholder="e.g. No overnight stays; return keys by 10pm…" {...register('usage_conditions')} />
            </div>
            <p className="text-[11px] text-surface-400 -mt-2">Ownership stays with the contributor — the project only receives usage rights.</p>
          </>
        )}

        {(type === 'asset' || type === 'in_kind') && (
          <div>
            <Label>Current location</Label>
            <Input placeholder="e.g. With Karim / Storage room 2 / Contributor's house" {...register('location')} />
          </div>
        )}

        {type === 'cash' && (
          <label className="flex items-start gap-2.5 rounded-lg bg-surface-50 ring-1 ring-inset ring-surface-200 px-3 py-3 cursor-pointer">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500" {...register('restricted')} />
            <span>
              <span className="block text-sm font-medium text-surface-800">Restricted contribution</span>
              <span className="block text-xs text-surface-500">
                This money may only be spent for specific agreed purposes. You'll set the purposes next.
              </span>
            </span>
          </label>
        )}
      </div>

      {/* Evidence */}
      <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 sm:p-5">
        <Label>Evidence / supporting document</Label>
        <p className="text-xs text-surface-500 -mt-1 mb-2">Photo of the transfer receipt, agreement or the contributed item.</p>
        <FileUpload files={files} onChange={setFiles} />
      </div>

      {submitError && (
        <div className="rounded-lg bg-red-50 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:ring-red-500/30 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">{submitError}</div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <Button variant="secondary" type="button" onClick={() => navigate(-1)} className="sm:w-40">Cancel</Button>
        <Button type="submit" size="lg" loading={submitting} className="flex-1">
          {editing ? 'Save changes' : 'Record contribution'}
        </Button>
      </div>
    </form>
  )
}
