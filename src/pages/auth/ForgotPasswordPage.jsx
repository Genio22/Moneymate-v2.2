import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { authApi } from '../../services/auth'
import { humanize } from '../../services/api'
import { Button } from '../../components/common/Button'
import { Input, Label } from '../../components/common/inputs'

const schema = z.object({ email: z.string().trim().email('Enter a valid email') })

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    setError,
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  const onSubmit = async (values) => {
    try {
      await authApi.sendPasswordReset(values.email)
      toast.success('Reset link sent — check your inbox.')
    } catch (e) {
      setError('root', { message: humanize(e) })
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface-900">Reset your password</h1>
      <p className="mt-1 text-sm text-surface-500">Enter your email and we'll send you a reset link.</p>

      {isSubmitSuccessful ? (
        <div className="mt-6 rounded-xl bg-accent-50 ring-1 ring-inset ring-accent-200 p-4 text-sm text-accent-800">
          If that email exists in MoneyMate, a reset link is on its way. Check your spam folder too.
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
          <div>
            <Label required>Email</Label>
            <Input type="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
          </div>
          {errors.root && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errors.root.message}</p>}
          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            Send reset link
          </Button>
        </form>
      )}

      <p className="mt-6 text-sm text-center text-surface-500">
        <Link to="/auth/login" className="font-semibold text-primary-600 hover:text-primary-700">
          Back to log in
        </Link>
      </p>
    </div>
  )
}
