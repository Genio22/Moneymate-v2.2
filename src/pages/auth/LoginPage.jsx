import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { loginSchema } from '../../schemas'
import { authApi } from '../../services/auth'
import { humanize } from '../../services/api'
import { Button } from '../../components/common/Button'
import { Input, Label } from '../../components/common/inputs'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/app'
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = async (values) => {
    try {
      await authApi.signIn(values.email, values.password)
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (e) {
      setError('root', { message: humanize(e) })
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface-900">Log in</h1>
      <p className="mt-1 text-sm text-surface-500">Welcome back — your projects are waiting.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
        <div>
          <Label required>Email</Label>
          <Input type="email" placeholder="you@example.com" autoComplete="email" error={errors.email?.message} {...register('email')} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label required>Password</Label>
            <Link to="/auth/forgot" className="text-xs font-medium text-primary-600 hover:text-primary-700">
              Forgot password?
            </Link>
          </div>
          <Input type="password" placeholder="••••••••" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        </div>

        {errors.root && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errors.root.message}</p>}

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-sm text-center text-surface-500">
        New to MoneyMate?{' '}
        <Link to="/auth/signup" className="font-semibold text-primary-600 hover:text-primary-700">
          Create an account
        </Link>
      </p>
    </div>
  )
}
