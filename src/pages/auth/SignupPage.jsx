import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { signupSchema } from '../../schemas'
import { authApi } from '../../services/auth'
import { humanize } from '../../services/api'
import { Button } from '../../components/common/Button'
import { Input, Label } from '../../components/common/inputs'

export default function SignupPage() {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { full_name: '', email: '', password: '' },
  })

  const onSubmit = async (values) => {
    try {
      const data = await authApi.signUp(values.email, values.password, values.full_name)
      if (!data.session) {
        toast.success('Account created! Check your email to confirm, then log in.')
        navigate('/auth/login', { replace: true })
        return
      }
      toast.success('Account created — welcome to MoneyMate!')
      navigate('/app', { replace: true })
    } catch (e) {
      setError('root', { message: humanize(e) })
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-surface-900">Create your account</h1>
      <p className="mt-1 text-sm text-surface-500">Free to use. Your data stays in your own Supabase project.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
        <div>
          <Label required>Full name</Label>
          <Input placeholder="e.g. Karim Ahmed" autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
        </div>
        <div>
          <Label required>Email</Label>
          <Input type="email" placeholder="you@example.com" autoComplete="email" error={errors.email?.message} {...register('email')} />
        </div>
        <div>
          <Label required>Password</Label>
          <Input type="password" placeholder="At least 8 characters" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        </div>

        {errors.root && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errors.root.message}</p>}

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Create account
        </Button>
        <p className="text-[11px] text-surface-400 text-center">
          If email confirmation is enabled on your Supabase project, you will be asked to confirm before logging in.
        </p>
      </form>

      <p className="mt-6 text-sm text-center text-surface-500">
        Already have an account?{' '}
        <Link to="/auth/login" className="font-semibold text-primary-600 hover:text-primary-700">
          Log in
        </Link>
      </p>
    </div>
  )
}
