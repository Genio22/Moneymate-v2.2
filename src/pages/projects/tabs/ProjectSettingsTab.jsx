import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Archive, FolderCheck, Pencil } from 'lucide-react'
import { projectsApi } from '../../../services/projects'
import { projectSchema } from '../../../schemas'
import { useProject } from '../../../hooks/useProject'
import { PROJECT_STATUSES, PROJECT_CATEGORIES } from '../../../constants'
import { titleCase } from '../../../utils/format'
import { PageHeader } from '../../../components/layout/PageHeader'
import { Card, CardBody } from '../../../components/common/Card'
import { Button } from '../../../components/common/Button'
import { Input, Label, Select, Textarea, AmountInput } from '../../../components/common/inputs'
import { ConfirmDialog } from '../../../components/common/Modal'
import { uploadProjectImage } from '../../../services/storage'

export default function ProjectSettingsTab() {
  const { projectId, project, isManager, refresh, setProject } = useProject()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: project.name,
    description: project.description || '',
    category: project.category || 'other',
    start_date: project.start_date || '',
    expected_end_date: project.expected_end_date || '',
    initial_budget: project.initial_budget ? String(project.initial_budget / 100) : '',
    status: project.status,
    image_url: project.image_url || '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [closeConfirm, setCloseConfirm] = useState(null)

  if (!isManager) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-surface-600">Only project managers can change project settings.</p>
        </CardBody>
      </Card>
    )
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const parsed = projectSchema.safeParse(form)
      if (!parsed.success) {
        setError(parsed.error.issues[0].message)
        setBusy(false)
        return
      }
      const patch = { ...parsed.data, initial_budget: form.initial_budget || undefined }
      const updated = await projectsApi.update(projectId, patch)
      setProject((p) => ({ ...p, ...updated }))
      toast.success('Project settings saved.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const uploadImage = async (file) => {
    try {
      const url = await uploadProjectImage(projectId, file)
      setForm((f) => ({ ...f, image_url: url }))
      await projectsApi.update(projectId, { image_url: url })
      refresh()
      toast.success('Project image updated.')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const changeStatus = async (status) => {
    try {
      const updated = await projectsApi.update(projectId, { status })
      setProject((p) => ({ ...p, ...updated }))
      toast.success(`Project marked as ${titleCase(status)}.`)
      if (status === 'archived') setTimeout(() => navigate('/app/projects'), 800)
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Project settings" subtitle="Details, budget and lifecycle" />

      <Card className="mb-4">
        <CardBody className="space-y-4">
          <div className="flex items-center gap-4">
            {form.image_url ? (
              <img src={form.image_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-surface-200" />
            ) : (
              <span className="w-16 h-16 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center text-2xl font-bold">
                {project.name[0]?.toUpperCase()}
              </span>
            )}
            <label className="cursor-pointer">
              <span className="inline-flex h-9 px-3 items-center rounded-lg border border-surface-200 bg-surface-50 text-sm font-medium text-surface-700 hover:bg-surface-50">
                <Pencil size={14} className="mr-2" /> Change image
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
            </label>
          </div>

          <div>
            <Label required>Project name</Label>
            <Input value={form.name} onChange={set('name')} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={set('description')} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label required>Category</Label>
              <Select value={form.category} onChange={set('category')}>
                {PROJECT_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </Select>
            </div>
            <div>
              <Label>Initial budget (৳)</Label>
              <AmountInput value={form.initial_budget} onChange={set('initial_budget')} placeholder="Optional" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label required>Start date</Label>
              <Input type="date" value={form.start_date} onChange={set('start_date')} />
            </div>
            <div>
              <Label>Expected end date</Label>
              <Input type="date" value={form.expected_end_date} onChange={set('expected_end_date')} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Button onClick={save} loading={busy}>Save changes</Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm font-semibold text-surface-900">Project lifecycle</p>
          <p className="text-xs text-surface-500">
            Current status: <b>{titleCase(project.status)}</b>. Closing a project stops nothing immediately — it marks
            completion; archived projects hide from active lists.
          </p>
          <div className="flex flex-wrap gap-2">
            {PROJECT_STATUSES.filter((s) => s.value !== project.status).map((s) => (
              <Button
                key={s.value}
                variant="secondary"
                size="sm"
                onClick={() => (s.value === 'archived' ? setCloseConfirm(s.value) : changeStatus(s.value))}
              >
                {s.value === 'archived' ? <Archive size={14} /> : <FolderCheck size={14} />}
                Mark {s.label}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(closeConfirm)}
        onClose={() => setCloseConfirm(null)}
        onConfirm={async () => {
          const s = closeConfirm
          setCloseConfirm(null)
          changeStatus(s)
        }}
        title="Archive this project?"
        message="All financial history is preserved, but the project is hidden from active lists. Members keep read access."
        confirmLabel="Archive project"
        danger
      />
    </div>
  )
}
