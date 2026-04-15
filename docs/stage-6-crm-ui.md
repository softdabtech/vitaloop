# Stage 6 CRM UI (VITALOOP)

## Scope
Stage 6 adds the first operational CRM UI shell on top of the Stage 5 backend.
The UI uses backend CRM APIs as source of truth and keeps role checks in frontend only as UX guards.

Lifecycle anchor used in UI:
User -> Questionnaire -> Analysis -> Program -> Execution -> Tracking -> Adjustment

## Implemented Screens

1. Ops Dashboard (`/ops`)
- Real stats from CRM APIs:
  - GET `/crm/clients`
  - GET `/crm/programs`
- Practitioner count attempts GET `/crm/practitioners` and shows backend-gap message when endpoint is missing.

2. Programs (`/crm/programs`)
- Program list (real API)
- Program details drawer (real object payload)
- Program create form (real API)
- Loading/empty/error states included

3. Clients (`/crm/clients`)
- Client list (real API)
- Onboarding, practitioner, subscription, active program signals visible
- Loading/empty/error states included

4. Client Details (`/crm/clients/:id`)
- Client overview block
- Program workflow block:
  - assign program
  - start program
  - pause program
- Questionnaire submit block (real endpoint)
- Interventions block (real endpoint, timeline kept in-session)
- Safe rendering with null checks

5. Practitioners (`/crm/practitioners`)
- Create practitioner form (real API)
- Direct practitioner lookup by ID (real API)
- Practitioner assignment modal (real API)
- List endpoint is wired but currently backend-gap if `/crm/practitioners` list is not available

6. Activity / Audit (`/crm/activity`)
- Screen and filters are wired to GET `/crm/audit-logs`
- If endpoint is missing, page shows explicit backend-gap state (no fake records)

## Route Map

- `/ops` -> Super admin CRM ops dashboard
- `/ops/legacy` -> previous legacy operations page
- `/crm/programs` -> Programs module
- `/crm/clients` -> Clients module
- `/crm/clients/:id` -> Client operational center
- `/crm/practitioners` -> Practitioner operations
- `/crm/activity` -> Audit/activity view

## Role UX Guards (frontend only)

- `super_admin`
  - full CRM access
  - `/ops` access
- `org_admin`
  - CRM module access except `/ops`
- `practitioner`
  - CRM module access except `/ops`
- `end_user`
  - redirected to `/dashboard` from CRM routes

Backend permission checks remain authoritative.

## API Integration Map

Shared API client: `frontend/src/api/crmClient.js`

Connected calls:
- `getPrograms` -> GET `/crm/programs`
- `createProgram` -> POST `/crm/programs`
- `getClients` -> GET `/crm/clients`
- `getClientById` -> GET `/crm/clients/{id}`
- `getPractitioners` -> GET `/crm/practitioners` (wired; backend list support pending)
- `getPractitionerById` -> GET `/crm/practitioners/{id}`
- `createPractitioner` -> POST `/crm/practitioners`
- `assignPractitioner` -> POST `/crm/practitioners/assign`
- `assignProgramToClient` -> POST `/crm/client-programs`
- `getClientProgram` -> GET `/crm/client-programs/{id}`
- `startClientProgram` -> POST `/crm/client-programs/{id}/start`
- `pauseClientProgram` -> POST `/crm/client-programs/{id}/pause`
- `submitQuestionnaire` -> POST `/crm/questionnaires/submit`
- `addIntervention` -> POST `/crm/client-programs/{id}/interventions`
- `getAuditLogs` -> GET `/crm/audit-logs` (wired; backend support pending)

## Architecture Added

- API layer:
  - `frontend/src/api/crmClient.js`
  - `frontend/src/api/crmPrograms.js`
  - `frontend/src/api/crmClients.js`
  - `frontend/src/api/crmPractitioners.js`
  - `frontend/src/api/crmQuestionnaires.js`
  - `frontend/src/api/crmAssignments.js`

- Hooks:
  - `frontend/src/hooks/useCRMQuery.js`
  - `frontend/src/hooks/useCRMRoleAccess.js`

- CRM shared UI:
  - layout/header/stat/badges/table-state/error/empty components

- Feature modules:
  - programs
  - clients
  - practitioners
  - interventions
  - audit

## Known Gaps (Backend-Dependent)

1. Practitioner list endpoint
- UI expects GET `/crm/practitioners` for table list.
- Current router has create/get-by-id/assign but may not expose list.

2. Audit log endpoint
- UI expects GET `/crm/audit-logs`.
- If endpoint is absent, page shows explicit unsupported state.

3. Questionnaire review depth
- Current backend exposes get-template + submit, but not full result listing endpoint.
- UI currently supports submit flow and safe payload rendering.

4. Assignment history by client
- Current UI stores newly created assignment in-session.
- Backend list-by-client endpoint would allow persistent workflow history hydration.

## Next Recommended Step

1. Add backend endpoints:
- GET `/crm/practitioners` (list)
- GET `/crm/audit-logs` (paginated)
- GET `/crm/client-programs?client_id=...` (history)
- GET `/crm/client-questionnaires?client_id=...` (review)

2. After those endpoints land, enable:
- full practitioner table
- persistent intervention timeline
- full questionnaire review section
- richer ops analytics widgets
