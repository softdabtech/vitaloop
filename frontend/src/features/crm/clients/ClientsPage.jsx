import { useCallback } from 'react'
import { getClients } from '../../../api/crmClients.js'
import { useCRMQuery } from '../../../hooks/useCRMQuery.js'
import CRMPageHeader from '../components/CRMPageHeader.jsx'
import ClientList from './ClientList.jsx'

export default function ClientsPage() {
  const queryFn = useCallback(() => getClients({ limit: 100, offset: 0 }), [])
  const { data, error, loading, refetch } = useCRMQuery(queryFn, [queryFn])

  return (
    <div>
      <CRMPageHeader title="Clients" subtitle="Operational client registry and onboarding statuses" />
      <ClientList
        loading={loading}
        error={error}
        clients={data?.items || []}
        onRetry={refetch}
      />
    </div>
  )
}
