import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { projectSchema } from '../../schemas'
import { projectsApi } from '../../services/projects'
import { uploadProjectImage } from '../../services/storage'
import { PROJECT_STATUSES, PROJECT_CATEGORIES } from '../../constants'
import { titleCase, todayISO } from '../../utils/format'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card, CardBody } from '../../components/common/Card'
import { Button } from '../../components/common/Button'
import { Input, Label, Select, Textarea, AmountInput } from '../../components/common/inputs'
import { useAuth } from '../../contexts/AuthContext'

export default function NewProjectPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [imageFile, setImageFile] = useState(null)
  const [error, setError] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'event',
      start_date: todayISO(),
      expected_end_date: '',
      initial_budget: '',
      status: 'active',
    },
  })

  const onSubmit = async (data) => {
    setError(null)
    try {
      const project = await projectsApi.create(data)
      if (imageFile) {
        try {
          const url = await uploadProjectImage(project.id, imageFile)
          await projectsApi.update(project.id, { image_url: url })
        } catch (e) {
          toast.error(`Project created, but the image failed to upload: ${e.message}`)
        }
      }
      toast.success('Project created! Now invite your members.')
      navigate(`/app/projects/${project.id}/members`)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Create a project" subtitle="Set it up in about a minute — you can change everything later." backTo="/app/projects" />
      <Card>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label required>Project name</Label>
            <Input placeholder="e.g. Freshers' Fest 2026" error={errors.name?.message} {...register('name')} />
          </div>
          <div>
            <Label>What is it about?</Label>
            <Textarea rows={3} placeholder="A short description members will see…" {...register('description')} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label required>Category</Label>
              <Select {...register('category')} error={errors.category?.message}>
                {PROJECT_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select {...register('status')}>
                {PROJECT_STATUSES.filter((s) => s.value !== 'archived').map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label required>Start date</Label>
              <Input type="date" error={errors.start_date?.message} {...register('start_date')} />
            </div>
            <div>
              <Label>Expected end date</Label>
              <Input type="date" {...register('expected_end_date')} />
            </div>
          </div>
          <div>
            <Label>Initial budget (৳)</Label>
            <AmountInput placeholder="Optional — e.g. 500000" error={errors.initial_budget?.message} {...register('initial_budget')} />
            <p className="mt-1 text-[11px] text-surface-400">Actual cash position is always computed from recorded transactions, not from this budget.</p>
          </div>
          <div>
            <Label>Project image</Label>
            <label className="cursor-pointer flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-surface-200 hover:border-primary-300 hover:bg-primary-50/40 transition">
              <span className="text-xs text-surface-400">{imageFile ? imageFile.name : 'Tap to choose a logo or cover photo (optional)'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Create project
          </Button>
          <p className="text-[11px] text-surface-400 text-center">You'll be the project owner and manager.</p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
