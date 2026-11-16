import { isSupabaseConfigured } from '../../lib/supabase'
import { Card, CardBody } from '../../components/common/Card'

/**
 * Shown when .env has no Supabase credentials. Explains the exact remaining
 * configuration step instead of failing with cryptic errors.
 */
export function ConfigNotice() {
  if (isSupabaseConfigured) return null
  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
      <Card className="max-w-xl w-full">
        <CardBody>
          <h1 className="text-xl font-bold text-surface-900 mb-2">Connect MoneyMate to Supabase</h1>
          <p className="text-sm text-surface-600 mb-4">
            The app is built but not connected to a backend yet. Add your project credentials to a
            <code className="mx-1 px-1.5 py-0.5 bg-surface-100 rounded text-xs">.env</code> file in the project root:
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto mb-4">
{`VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
          <ol className="list-decimal list-inside text-sm text-surface-600 space-y-1.5">
            <li>Create a project at <span className="font-medium">supabase.com/dashboard</span>.</li>
            <li>Run the SQL migrations from <code className="text-xs bg-surface-100 px-1 rounded">supabase/migrations/</code> in order (0001 → 0005) in the SQL Editor.</li>
            <li>Copy the URL and anon key from <span className="font-medium">Settings → API</span> into <code className="text-xs bg-surface-100 px-1 rounded">.env</code>.</li>
            <li>Restart the dev server (<code className="text-xs bg-surface-100 px-1 rounded">npm run dev</code>).</li>
          </ol>
          <p className="text-xs text-surface-400 mt-4">Full instructions are in README.md.</p>
        </CardBody>
      </Card>
    </div>
  )
}
