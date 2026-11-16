import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authApi } from '../../services/auth'
import { humanize } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/common/Button'
import { Input, Label } from '../../components/common/inputs'

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [done, setDone] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } })

  const onSubmit = async (values) => {
    try {
      await authApi.updatePassword(values.password)
      setDone(true)
      toast.success('Password updated.')
      setTimeout(() => navigate('/app', { replace: true }), 1200)
    } catch (e) {
      setError('root', { message: humanize(e) })
    }
  }

  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Set a new password</h1>
        <p className="mt-2 text-sm text-surface-500">
          Open the reset link from your email first — it signs you in securely. You can request a new link from the
          login page.
        </p>
        <Link to="/auth/forgot" className="mt-5 inline-flex h-10 px-4 items-center rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
          Request reset link
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface-900">Set a new password</h1>
      <p className="mt-1 text-sm text-surface-500">Choose a strong password you don't use anywhere else.</p>

      {done ? (
        <div className="mt-6 rounded-xl bg-accent-50 ring-1 ring-inset ring-accent-200 p-4 text-sm text-accent-800">
          Password updated. Redirecting to your dashboard…
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
          <div>
            <Label required>New password</Label>
            <Input type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          </div>
          <div>
            <Label required>Confirm password</Label>
            <Input type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
          </div>
          {errors.root && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errors.root.message}</p>}
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            Update password
          </Button>
        </form>
      )}
    </div>
  )
}
