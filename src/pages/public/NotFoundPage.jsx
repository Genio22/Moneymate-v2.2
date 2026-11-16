import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface-100 flex flex-col items-center justify-center p-6 text-center">
      <p className="text-6xl font-extrabold text-primary-200">404</p>
      <h1 className="mt-2 text-xl font-bold text-surface-900">Page not found</h1>
      <p className="mt-1 text-sm text-surface-500 max-w-sm">
        The page you are looking for does not exist or has moved.
      </p>
      <div className="mt-5 flex gap-3">
        <Link to="/app" className="h-10 px-4 inline-flex items-center rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
          Go to dashboard
        </Link>
        <Link to="/" className="h-10 px-4 inline-flex items-center rounded-lg bg-surface-50 border border-surface-200 text-sm font-medium text-surface-700 hover:bg-surface-50">
          Home
        </Link>
      </div>
    </div>
  )
}
