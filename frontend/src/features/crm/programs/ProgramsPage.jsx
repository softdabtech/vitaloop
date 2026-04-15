import toast from 'react-hot-toast'
import { useCallback, useMemo, useState } from 'react'
import { getPrograms, createProgram } from '../../../api/crmPrograms.js'
import { useCRMQuery, useCRMMutation } from '../../../hooks/useCRMQuery.js'
import { useCRMRoleAccess } from '../../../hooks/useCRMRoleAccess.js'
import CRMPageHeader from '../components/CRMPageHeader.jsx'
import ProgramForm from './ProgramForm.jsx'
import ProgramList from './ProgramList.jsx'
import ProgramDetailsDrawer from './ProgramDetailsDrawer.jsx'

export default function ProgramsPage() {
  const [selected, setSelected] = useState(null)
  const { canManagePrograms } = useCRMRoleAccess()

  const queryFn = useCallback(() => getPrograms({ limit: 100, offset: 0 }), [])
  const { data, error, loading, refetch } = useCRMQuery(queryFn, [queryFn])
  const createMutation = useCRMMutation(createProgram)

  const programs = useMemo(() => data?.items || [], [data])

  async function handleCreate(payload) {
    try {
      await createMutation.mutate(payload)
      toast.success('Program created')
      refetch()
    } catch (err) {
      toast.error(err.message || 'Failed to create program')
    }
  }

  return (
    <div>
      <CRMPageHeader title="Programs" subtitle="Template library for client lifecycle plans" />
      <div style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
        <ProgramForm onSubmit={handleCreate} submitting={createMutation.loading} canManage={canManagePrograms} />
      </div>
      <ProgramList
        loading={loading}
        error={error}
        programs={programs}
        onRetry={refetch}
        onSelect={setSelected}
      />
      <ProgramDetailsDrawer program={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
