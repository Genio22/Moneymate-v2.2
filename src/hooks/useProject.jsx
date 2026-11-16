import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { projectsApi } from '../services/projects'
import { useAuth } from '../contexts/AuthContext'
import { Spinner } from '../components/common/Spinner'
import { DataState } from '../components/common/DataState'
import { ProjectLayout } from '../components/layout/ProjectLayout'

const ProjectContext = createContext(null)

/** Loads project + membership + financial summary once per navigation. */
export function ProjectProvider({ children }) {
  const { projectId } = useParams()
  const { user } = useAuth()
  const [project, setProject] = useState(null)
  const [summary, setSummary] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [p, s, m] = await Promise.all([
        projectsApi.get(projectId),
        projectsApi.summary(projectId),
        projectsApi.members(projectId),
      ])
      if (!p) {
        setError('Project not found, or you are not a member of it.')
        return
      }
      setProject(p)
      setSummary(s)
      setMembers(m)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const role = project ? (members.find((m) => m.user?.id === user?.id)?.role || (project.owner_id === user?.id ? 'manager' : null)) : null

  const value = useMemo(
    () => ({
      projectId,
      project,
      summary,
      members,
      loading,
      error,
      refresh,
      setProject,
      role,
      isManager: role === 'manager',
    }),
    [projectId, project, summary, members, loading, error, refresh, role],
  )

  if (loading) return <div className="p-10"><Spinner size="lg" label="Loading project…" /></div>
  if (error) return <DataState error={error} />
  return (
    <ProjectContext.Provider value={value}>
      <ProjectLayout />
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used inside ProjectProvider')
  return ctx
}
