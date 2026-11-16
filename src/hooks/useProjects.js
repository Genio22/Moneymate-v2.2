import { useEffect, useState, useCallback, useRef } from 'react'
import { projectsApi } from '../services/projects'

/** Projects of the signed-in user + lightweight financial summaries. */
export function useProjects() {
  const [projects, setProjects] = useState([])
  const [summaries, setSummaries] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await projectsApi.listMy()
      setProjects(list)
      const ids = list.map((p) => p.id)
      if (ids.length) {
        const sums = await projectsApi.summaryForMany(ids)
        setSummaries(Object.fromEntries(sums.map((s) => [s.project_id, s.summary])))
      } else {
        setSummaries({})
      }
    } catch (e) {
      setError(e.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { projects, summaries, loading, error, refresh }
}
