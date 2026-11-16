import { ContributionForm } from '../../components/contributions/ContributionForm'
import { PageHeader } from '../../components/layout/PageHeader'
import { useProject } from '../../hooks/useProject'

export default function NewContributionPage() {
  const { project, projectId } = useProject()
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Add contribution"
        subtitle={`${project?.name || ''} — record money, material, asset or access you received.`}
        backTo={`/app/projects/${projectId}/contributions`}
      />
      <ContributionForm projectId={projectId} />
    </div>
  )
}
