import { ExpenseForm } from '../../components/forms/ExpenseForm'
import { PageHeader } from '../../components/layout/PageHeader'
import { useProject } from '../../hooks/useProject'

export default function NewExpensePage() {
  const { project } = useProject()
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Add expense"
        subtitle={`${project?.name || ''} — 4 quick questions and a receipt photo.`}
        backTo={`/app/projects/${project?.id}/transactions`}
      />
      <ExpenseForm projectId={project?.id} />
    </div>
  )
}
