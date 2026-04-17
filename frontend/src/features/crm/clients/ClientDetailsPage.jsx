import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getClientById } from '../../../api/crmClients.js'
import { getPrograms } from '../../../api/crmPrograms.js'
import {
  assignProgramToClient,
  startClientProgram,
  pauseClientProgram,
  addIntervention,
} from '../../../api/crmAssignments.js'
import { submitQuestionnaire } from '../../../api/crmQuestionnaires.js'
import { useCRMQuery, useCRMMutation } from '../../../hooks/useCRMQuery.js'
import { useCRMRoleAccess } from '../../../hooks/useCRMRoleAccess.js'
import CRMTableState from '../components/CRMTableState.jsx'
import CRMPageHeader from '../components/CRMPageHeader.jsx'
import ClientOverviewCard from './ClientOverviewCard.jsx'
import ClientProgramCard from './ClientProgramCard.jsx'
import ClientQuestionnaireCard from './ClientQuestionnaireCard.jsx'
import InterventionsPanel from '../interventions/InterventionsPanel.jsx'

export default function ClientDetailsPage() {
  const { id } = useParams()
  const { canManageClients, canCreateIntervention } = useCRMRoleAccess()
  const [assignment, setAssignment] = useState(null)
  const [localInterventions, setLocalInterventions] = useState([])

  const clientQuery = useCallback(() => getClientById(id), [id])
  const programsQuery = useCallback(() => getPrograms({ limit: 100, offset: 0 }), [])

  const { data: client, error, loading, refetch } = useCRMQuery(clientQuery, [clientQuery])
  const { data: programsData } = useCRMQuery(programsQuery, [programsQuery])

  const assignMutation = useCRMMutation(assignProgramToClient)
  const startMutation = useCRMMutation(startClientProgram)
  const pauseMutation = useCRMMutation(pauseClientProgram)
  const interventionMutation = useCRMMutation(({ assignmentId, payload }) => addIntervention(assignmentId, payload))
  const questionnaireMutation = useCRMMutation(submitQuestionnaire)

  const mutateLoading = assignMutation.loading || startMutation.loading || pauseMutation.loading
  const programs = useMemo(() => programsData?.items || [], [programsData])

  async function handleAssign(payload) {
    try {
      const result = await assignMutation.mutate(payload)
      setAssignment(result)
      toast.success('Program assigned to client')
      refetch()
    } catch (err) {
      toast.error(err.message || 'Failed to assign program')
    }
  }

  async function handleStart(assignmentId) {
    try {
      const result = await startMutation.mutate(assignmentId)
      setAssignment(result)
      toast.success('Program started')
    } catch (err) {
      toast.error(err.message || 'Failed to start program')
    }
  }

  async function handlePause(assignmentId) {
    try {
      const result = await pauseMutation.mutate(assignmentId)
      setAssignment(result)
      toast.success('Program paused')
    } catch (err) {
      toast.error(err.message || 'Failed to pause program')
    }
  }

  async function handleQuestionnaire(payload) {
    try {
      const result = await questionnaireMutation.mutate(payload)
      toast.success(`Questionnaire submitted. Score: ${result?.score ?? 'n/a'}`)
    } catch (err) {
      toast.error(err.message || 'Failed to submit questionnaire')
    }
  }

  async function handleIntervention(payload) {
    try {
      const result = await interventionMutation.mutate({ assignmentId: assignment?.id, payload })
      setLocalInterventions((prev) => [result, ...prev])
      toast.success('Intervention recorded')
    } catch (err) {
      toast.error(err.message || 'Failed to add intervention')
    }
  }

  return (
    <div>
      <CRMPageHeader title="Client Profile" subtitle="Lifecycle center: onboarding, program, interventions, questionnaire" />
      <CRMTableState loading={loading} error={error} onRetry={refetch} isEmpty={!client} emptyTitle="Client not found" emptyDescription="This client may be unavailable for your role.">
        <div className="grid gap-3 lg:grid-cols-2">
          <ClientOverviewCard client={client} />
          <ClientProgramCard
            client={client}
            programs={programs}
            assignment={assignment}
            onAssign={handleAssign}
            onStart={handleStart}
            onPause={handlePause}
            mutateLoading={mutateLoading}
            canManage={canManageClients}
          />
          <ClientQuestionnaireCard
            clientId={client?.id}
            onSubmit={handleQuestionnaire}
            loading={questionnaireMutation.loading}
          />
          <InterventionsPanel
            assignmentId={assignment?.id}
            interventions={localInterventions}
            onAdd={handleIntervention}
            loading={interventionMutation.loading}
            canSubmit={canCreateIntervention}
          />
        </div>
      </CRMTableState>
    </div>
  )
}
