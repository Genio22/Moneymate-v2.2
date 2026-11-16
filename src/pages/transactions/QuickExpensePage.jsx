import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ExpenseForm } from '../../components/forms/ExpenseForm'
import { PageHeader } from '../../components/layout/PageHeader'
import { useProjects } from '../../hooks/useProjects'
import { Spinner } from '../../components/common/Spinner'
import { Button } from '../../components/common/Button'
import clsx from 'clsx'

/** "/app/add" — pick the project (when ambiguous), then the expense form. */
export default function QuickExpensePage() {
  const [params] = useSearchParams()
  const { projects, summaries, loading } = useProjects()
  const navigate = useNavigate()
  const preselect = params.get('project')
  const [chosen, setChosen] = useState(preselect)

  useEffect(() => {
    if (!preselect && projects.length === 1) setChosen(projects[0].id)
  }, [preselect, projects])

  const active = projects.filter((p) => !['archived', 'completed'].includes(p.status))

  if (loading) return <Spinner label="Loading projects…" />

  if (chosen) {
    const project = projects.find((p) => p.id === chosen)
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title="Add expense"
          subtitle={`${project?.name} — 4 quick questions and a receipt photo.`}
          backTo="/app"
        />
        <ExpenseForm projectId={chosen} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Add expense" subtitle="Which project was this purchase for?" backTo="/app" />
      {active.length === 0 ? (
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-8 text-center">
          <p className="font-medium text-surface-800">No active projects</p>
          <p className="text-sm text-surface-500 mt-1">Create or join a project first.</p>
          <Button className="mt-4" onClick={() => navigate('/app/projects/new')}>Create a project</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {active.map((p) => (
            <button
              key={p.id}
              onClick={() => setChosen(p.id)}
              className="rounded-xl border border-surface-200 bg-surface-50 p-4 text-left hover:border-primary-400 hover:shadow-card transition"
            >
              <p className="font-semibold text-surface-900">{p.name}</p>
              <p className="text-xs text-surface-500 mt-0.5">
                {p.my_role === 'manager' ? 'You manage this project' : 'Member'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
