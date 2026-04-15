# STAGE 5: CRM Core Data Model & Architecture

**Version:** 1.0  
**Date:** April 2026  
**Status:** Architecture Design (No UI code)

---

## 1. BUSINESS MODEL ANALYSIS

### Product Overview

**VITALOOP** is a longitudinal health intelligence platform that enables users to:

1. **Upload** blood/lab reports (OCR extraction)
2. **Analyze** biomarkers with AI-driven insights
3. **Receive** personalized protocols and recommendations
4. **Track** health metrics, symptoms, and progress over time
5. **Engage** with health specialists (1:1 Personal tier) for guided optimization

### Pricing Tiers

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0 | 1 lab upload, basic insights, no protocol |
| **Core** | $29/mo | Unlimited uploads, full analysis, personalized protocol, progress tracking |
| **Personal** | $99/mo | Everything in Core + 1:1 specialist guidance, protocol adjustments, priority support |

### Key Actors

| Actor | Role | Responsibilities |
|-------|------|-----------------|
| **End User (Client)** | Upload labs, complete questionnaires, track progress | Use platform for health optimization |
| **Practitioner (Specialist)** | Provide guidance to Personal tier clients | Adjust protocols, answer questions, monitor progress |
| **Org Admin** | Manage team members, view collective progress | Oversee organization data and members |
| **Super Admin (OPS)** | Global platform operations | Subscription management, global user management, support |

### Lifecycle Flow

```
1. User Signup
   ↓
2. Create Client Profile (onboarding_status = "started")
   ↓
3. Complete Onboarding Questionnaire
   ↓
4. Assign Program (or AI-suggest based on responses)
   ↓
5. Allow Optional Practitioner Assignment (Personal tier only)
   ↓
6. Execution Phase:
   - Upload lab reports
   - Log symptoms weekly
   - Receive protocol checks/adjustments
   - Track biomarker trends
   ↓
7. Tracking & Iteration
   - Review progress
   - Adjust program
   - Re-test at intervals
```

---

## 2. CORE ENTITIES & SCHEMAS

### Entity Relationship Diagram (Text)

```
┌─────────────┐
│   users     │ (exists: Supabase auth.users extension)
│  ─────────  │
│  id (PK)    │
│  email      │
│  full_name  │
│  global_role│ (super_admin, admin, end_user)
│  sub_status │ (free, active, cancelled)
│  timezone   │
└──────┬──────┘
       │
       ├──┐
       │  │ 1:N
       │  └─────────────────────────┐
       │                            │
       │     ┌─────────────────┐   ┌─────────────────┐
       │     │   clients       │   │  practitioners  │
       │     │  ────────────   │   │  ───────────────│
       │     │  id (PK)        │   │  id (PK)        │
       │     │  user_id (FK)   │   │  user_id (FK)   │
       │     │  assigned_prac- │   │  specialization │
       │     │  titioner_id    │   │  bio            │
       │     │  (FK→prac)      │   │  status         │
       │     │  onboarding_st- │   │  created_at     │
       │     │  atus           │   └─────────────────┘
       │     │  active_program │        ▲
       │     │  _id (FK→pgm)   │        │ 0:1
       │     │  subscription_  │        │
       │     │  id (FK→sub)    │        │
       │     │  created_at     │        │ 1:N
       │     └────────┬────────┘        │
       │              │                 │
       │              │ 1:N             │
       │              │                 │
       │     ┌────────┴──────────────┐  │
       │     │ client_programs       │  │
       │     │ ──────────────────    │  │
       │     │ id (PK)               │  │
       │     │ client_id (FK)────────┼──┘
       │     │ program_id (FK)       │
       │     │ status (active,       │
       │     │   paused, completed)  │
       │     │ assigned_date         │
       │     │ updated_at            │
       │     └──────────────────     │
       │                             │
       ├──────────────────────────┐  │
       │                          │  │
       │ 1:N                      │  │
       │                    ┌─────┴──┘
       │                    │
       │            ┌───────┴────────┐
       │            │   programs     │
       │            │  ────────────  │
       │            │  id (PK)       │
       │            │  name          │
       │            │  description   │
       │            │  duration_days │
       │            │  category      │
       │            │  status        │
       │            │  created_at    │
       │            └────┬───────────┘
       │                 │
       ├──┐              │
       │  │ 1:N          │
       │  │              │
       │  │   ┌──────────┴─────────────┐
       │  │   │ client_questionnaires │
       │  │   │ ────────────────────  │
       │  │   │ id (PK)               │
       │  │   │ client_id (FK)        │
       │  │   │ questionnaire_id (FK) │
       │  │   │ responses (JSONB)     │
       │  │   │ score                 │
       │  │   │ result                │
       │  │   │ completed_at          │
       │  │   └───────┬────────────────┘
       │  │           │
       │  │ 1:N  ┌────┴──────────────────┐
       │  │      │ questionnaires       │
       │  │      │ ────────────────────│
       │  │      │ id (PK)             │
       │  │      │ template_type       │
       │  │      │ (onboarding,        │
       │  │      │  progress, program) │
       │  │      │ questions (JSONB)   │
       │  │      │ scoring_logic (JSON)│
       │  │      │ created_at          │
       │  │      └─────────────────────┘
       │  │
       │  └───────────────────┐
       │                      │
       ├──┐ 1:N               │
       │  │                   │
       │  └──────────────────┐│
       │                     ││
       │     ┌───────────────┴┴────────┐
       │     │  subscriptions          │
       │     │  ─────────────────────  │
       │     │  id (PK)                │
       │     │  user_id (FK)           │
       │     │  plan_name              │
       │     │  status (active, paused,│
       │     │    cancelled)           │
       │     │  stripe_id              │
       │     │  stripe_status          │
       │     │  current_period_end     │
       │     │  started_at             │
       │     │  updated_at             │
       │     └─────────────────────────┘
       │
       └──┐ 1:N
          │
          ├──────────────────────────────┐
          │                              │
    ┌─────┴──────────┐  ┌───────────────┴──┐
    │ organizations  │  │ audit_logs       │
    │ ─────────────  │  │ ────────────────│
    │ id (PK)        │  │ id (PK)         │
    │ name           │  │ user_id (FK)    │
    │ slug           │  │ action          │
    │ owner_id (FK)  │  │ entity_type     │
    │ status         │  │ entity_id       │
    │ created_at     │  │ changes (JSONB) │
    │                │  │ created_at      │
    └────┬───────────┘  └─────────────────┘
         │
         │ 1:N
         │
    ┌────┴────────────────────┐
    │ organization_members    │
    │ ──────────────────────  │
    │ id (PK)                 │
    │ organization_id (FK)    │
    │ user_id (FK)            │
    │ org_role (admin,        │
    │  practitioner, member)  │
    │ status (active, invited)│
    │ joined_at               │
    └─────────────────────────┘
```

### Table Schemas

#### 1. `practitioners` (NEW)

```sql
CREATE TABLE public.practitioners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  specialization TEXT NOT NULL
    CHECK (specialization IN ('nutrition', 'biohacking', 'performance', 'general')),
  bio TEXT,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'onboarding')),
  availability TEXT DEFAULT 'available'
    CHECK (availability IN ('available', 'booked', 'unavailable')),
  max_clients SMALLINT DEFAULT 20,
  current_clients SMALLINT DEFAULT 0,
  hourly_rate_cents INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_practitioners_user_id ON public.practitioners(user_id);
CREATE INDEX idx_practitioners_status ON public.practitioners(status);
```

#### 2. `clients` (NEW)

```sql
CREATE TABLE public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  assigned_practitioner_id UUID REFERENCES public.practitioners(id) ON DELETE SET NULL,
  onboarding_status TEXT DEFAULT 'started'
    CHECK (onboarding_status IN ('started', 'questionnaire_pending', 'program_assigned', 'active', 'paused', 'completed')),
  active_program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  last_upload_at TIMESTAMPTZ,
  last_check_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_clients_practitioner_id ON public.clients(assigned_practitioner_id);
CREATE INDEX idx_clients_active_program_id ON public.clients(active_program_id);
CREATE INDEX idx_clients_subscription_id ON public.clients(subscription_id);
CREATE INDEX idx_clients_onboarding_status ON public.clients(onboarding_status);
```

#### 3. `programs` (NEW)

```sql
CREATE TABLE public.programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT
    CHECK (category IN ('metabolic-optimization', 'longevity', 'athletic-performance', 'wellness', 'custom')),
  duration_days INT CHECK (duration_days > 0),
  template_protocol JSONB,
  biomarker_targets JSONB,
  checkpoint_intervals INT[] DEFAULT '{7,14,30,60,90}',
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'deprecated', 'archived')),
  created_by_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_programs_category ON public.programs(category);
CREATE INDEX idx_programs_status ON public.programs(status);
```

#### 4. `client_programs` (NEW)

```sql
CREATE TABLE public.client_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE RESTRICT NOT NULL,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  started_date TIMESTAMPTZ,
  projected_end_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  checkpoint_progress JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_programs_client_id ON public.client_programs(client_id);
CREATE INDEX idx_client_programs_program_id ON public.client_programs(program_id);
CREATE INDEX idx_client_programs_status ON public.client_programs(status);
CREATE UNIQUE INDEX uq_client_programs_active ON public.client_programs(client_id) 
  WHERE status IN ('active', 'paused');
```

#### 5. `questionnaires` (NEW)

```sql
CREATE TABLE public.questionnaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_type TEXT
    CHECK (template_type IN ('onboarding', 'progress-check', 'program-specific', 'symptom-tracker')),
  questions JSONB NOT NULL,
  scoring_logic JSONB,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'draft', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questionnaires_template_type ON public.questionnaires(template_type);
CREATE INDEX idx_questionnaires_program_id ON public.questionnaires(program_id);
```

**Questionnaire JSON Structure Example:**

```json
{
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "label": "What is your main health goal?",
      "required": true
    },
    {
      "id": "q2",
      "type": "multiple-choice",
      "label": "Select your current activity level",
      "options": ["sedentary", "light", "moderate", "intense"],
      "required": true
    },
    {
      "id": "q3",
      "type": "scale",
      "label": "Rate your energy level (1-10)",
      "min": 1,
      "max": 10,
      "required": true
    }
  ],
  "scoring_logic": {
    "scale_questions": ["q3"],
    "weights": { "q2": 1.5, "q3": 1.0 }
  }
}
```

#### 6. `client_questionnaires` (NEW)

```sql
CREATE TABLE public.client_questionnaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  questionnaire_id UUID REFERENCES public.questionnaires(id) ON DELETE RESTRICT NOT NULL,
  responses JSONB NOT NULL,
  score NUMERIC(5,2),
  result_notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_questionnaires_client_id ON public.client_questionnaires(client_id);
CREATE INDEX idx_client_questionnaires_questionnaire_id ON public.client_questionnaires(questionnaire_id);
CREATE INDEX idx_client_questionnaires_completed_at ON public.client_questionnaires(completed_at DESC);
```

**Responses JSON Structure Example:**

```json
{
  "q1": "Improve energy and focus",
  "q2": "moderate",
  "q3": 5
}
```

#### 7. `subscriptions` (NEW)

```sql
CREATE TABLE public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  plan_name TEXT NOT NULL
    CHECK (plan_name IN ('free', 'core', 'personal')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'past_due')),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_status TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_plan_name ON public.subscriptions(plan_name);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
```

#### 8. `audit_logs` (NEW)

```sql
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL
    CHECK (action IN ('create', 'read', 'update', 'delete', 'assign', 'reassign')),
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('client', 'practitioner', 'program', 'subscription', 'questionnaire')),
  entity_id UUID NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
```

---

## 3. ROLE ACCESS MATRIX

| Feature | End User | Practitioner | Org Admin | Super Admin | Notes |
|---------|----------|--------------|-----------|-------------|-------|
| **View Own Client Profile** | ✓ | ✓* | — | — | *Practitioner sees assigned clients |
| **Edit Own Client Profile** | ✓ | — | — | — | |
| **View Own Lab Uploads** | ✓ | ✓* | ✓ | ✓ | *Practitioner sees assigned clients' uploads |
| **Upload Lab Report** | ✓ | — | — | — | |
| **View Protocols** | ✓ | ✓* | ✓ | ✓ | *Practitioner sees assigned clients' protocols |
| **Adjust Protocol** | — | ✓ | — | ✓ | Personal tier only |
| **View Program Templates** | — | ✓ | ✓ | ✓ | |
| **Create/Edit Program** | — | — | — | ✓ | OPS only |
| **Assign Program** | — | ✓ | ✓ | ✓ | |
| **Assign Practitioner** | — | — | ✓ | ✓ | Org admin for org users, Super admin globally |
| **View Client List** | — | ✓ | ✓ | ✓ | Practitioners see assigned; Admins see org users; Super_admin sees all |
| **Add Client to Organization** | — | — | ✓ | ✓ | |
| **Manage Org Members** | — | — | ✓ | ✓ | |
| **View Subscriptions** | ✓ | — | ✓ | ✓ | |
| **Manage Subscriptions** | — | — | — | ✓ | OPS only |
| **View Audit Logs** | — | — | ✓ | ✓ | |
| **View Global Users** | — | — | — | ✓ | OPS only |

---

## 4. API ENDPOINTS LIST

### Auth Endpoints (Existing)

```
POST   /auth/login                  # Supabase auth
GET    /auth/me                     # Current user context
POST   /auth/logout                 # Sign out
```

### Client Endpoints (NEW)

```
GET    /api/clients                 # Get all clients (by role: org, my assigned)
GET    /api/clients/:id             # Get client detail
POST   /api/clients                 # Create client (on signup)
PATCH  /api/clients/:id             # Update client profile
GET    /api/clients/:id/programs    # Get client's program history
GET    /api/clients/:id/uploads     # Get client's lab uploads
GET    /api/clients/:id/progress    # Get client progress summary
```

### Practitioner Endpoints (NEW)

```
GET    /api/practitioners           # List practitioners (OPS/Org admin)
GET    /api/practitioners/:id       # Get practitioner detail
POST   /api/practitioners           # Create practitioner (OPS)
PATCH  /api/practitioners/:id       # Update practitioner info
GET    /api/practitioners/:id/clients    # Get assigned clients
PUT    /api/practitioners/:id/assign-client/:client_id  # Assign client
DELETE /api/practitioners/:id/unassign-client/:client_id # Unassign client
```

### Program Endpoints (NEW)

```
GET    /api/programs                # List all programs (with filter by category)
GET    /api/programs/:id            # Get program detail
POST   /api/programs                # Create program (OPS)
PATCH  /api/programs/:id            # Update program (OPS)
GET    /api/programs/:id/questionnaires  # Get program's questionnaire templates
```

### Client Program Endpoints (NEW)

```
POST   /api/client-programs         # Assign program to client
GET    /api/client-programs/:id     # Get assignment detail
PATCH  /api/client-programs/:id     # Update status (pause, resume, complete)
GET    /api/client-programs/:id/progress  # Get checkpoint progress
DELETE /api/client-programs/:id     # Unassign program
```

### Questionnaire Endpoints (NEW)

```
GET    /api/questionnaires          # List templates
GET    /api/questionnaires/:id      # Get template detail
POST   /api/questionnaires          # Create template (OPS)
PATCH  /api/questionnaires/:id      # Update template (OPS)
POST   /api/questionnaires/:id/submit  # Submit responses as client
GET    /api/questionnaires/client/:client_id/responses  # Get responses history
```

### Subscription Endpoints (NEW)

```
GET    /api/subscriptions           # Get user's subscription (own)
GET    /api/subscriptions/:user_id  # Get subscription (OPS)
POST   /api/subscriptions           # Create subscription with Stripe
PATCH  /api/subscriptions/:id       # Update subscription (pause, change plan)
DELETE /api/subscriptions/:id       # Cancel subscription
POST   /api/subscriptions/webhook   # Stripe webhook handler
```

### Audit Log Endpoints (NEW)

```
GET    /api/audit-logs              # Get logs (Org admin/OPS filtered by role)
GET    /api/audit-logs?entity_type=client&entity_id=:id  # Filter by entity
```

### Organization Endpoints (Existing, Enhanced)

```
GET    /api/organizations           # Get user's organizations
GET    /api/organizations/:id       # Get org detail
POST   /api/organizations           # Create org
PATCH  /api/organizations/:id       # Update org settings
GET    /api/organizations/:id/members  # Get org members with roles
```

---

## 5. KEY BUSINESS LOGIC

### 5.1 Post-Signup Flow

```python
# Backend route: POST /auth/register
# Supabase trigger on auth.users AFTER INSERT:
1. Create user profile in public.users
2. Create client profile in public.clients
   - onboarding_status = "started"
   - subscription_id = NULL
   - assigned_practitioner_id = NULL
3. Create free subscription in public.subscriptions
   - plan_name = "free"
   - status = "active"
4. Create onboarding questionnaire task
5. Log audit event: "create" entity_type="client"
6. Redirect to /onboarding
```

### 5.2 Onboarding Questionnaire Completion

```python
# Backend route: POST /api/questionnaires/:id/submit
# Called by: End user after completing onboarding form
1. Fetch questionnaire template
2. Validate responses against scoring_logic
3. Calculate score/result
4. Store in client_questionnaires
5. AI Engine:
   - Analyze responses + lab uploads (if any)
   - Suggest program_id based on lifestyle/goals
6. Update client.onboarding_status = "program_assigned"
7. If client subscribed to Personal:
   - Mark for practitioner assignment
   - Notify admins
8. Log audit event: "create" entity_type="client_questionnaire"
9. Return suggested_program (frontend can offer "start program" button)
```

### 5.3 Program Assignment

```python
# Backend route: POST /api/client-programs
# Called by: Org admin / Practitioner / OPS
# Role check: 
#   - Must be OrgAdmin for org members
#   - Practitioner can assign to own clients
#   - Super_admin can assign globally
1. Validate client exists and accessible to caller
2. Validate program exists
3. Create client_programs entry
   - status = "active"
   - assigned_date = NOW()
   - projected_end_date = NOW() + program.duration_days
4. Update client.active_program_id = program_id
5. Update client.onboarding_status = "active" (if was "program_assigned")
6. If program has checkpoint_intervals:
   - Schedule reminder notifications
7. Log audit event: "assign" entity_type="program"
```

### 5.4 Practitioner Assignment (Personal Tier)

```python
# Backend route: PUT /api/clients/:id/assign-practitioner/:practitioner_id
# Preconditions:
# - client.subscription.plan_name == "personal"
# - client.subscription.status == "active"
# - practitioner.status == "active"
# - practitioner.current_clients < practitioner.max_clients
1. Validate permissions (Org admin / Super_admin)
2. Validate practitioner availability
3. Update client.assigned_practitioner_id = practitioner_id
4. Increment practitioner.current_clients
5. Create initial check-in session
6. Send notification emails:
   - To client: "Your specialist is [Name]"
   - To practitioner: "New client: [Name]"
7. Log audit event: "assign" entity_type="client" changes={"assigned_practitioner_id": "..."}
```

### 5.5 Protocol Adjustment by Practitioner

```python
# Backend route: PATCH /api/protocols/:id
# Called by: Assigned practitioner
# (Existing protocol belongs to a lab_upload, now with practitioner context)
1. Fetch existing protocol
2. Validate caller is assigned practitioner
3. Update recommendations JSONB
4. Add adjustment_notes
5. Increment adjustment_count
6. Log audit event: "update" entity_type="protocol"
7. Notify client: "Your protocol was updated"
8. Mark client for re-check-in (schedule weekly check-in if not recent)
```

### 5.6 Weekly Check-In (Progress Tracking)

```python
# Backend route: POST /api/checkins
# Called by: Client or scheduled job
1. Fetch latest protocol for client
2. Load progress_check questionnaire
3. Client answers: symptom changes, protocol adherence, etc.
4. Store in client_questionnaires
5. If client has assigned_practitioner:
   - Flag for practitioner review
   - Add to practitioner dashboard
6. Update client.last_check_in_at = NOW()
7. Log audit event: "create" entity_type="client_questionnaire"
```

### 5.7 Subscription Management (Stripe Integration)

```python
# Backend route: POST /api/subscriptions
# Called by: Frontend checkout, with plan_name + Stripe payment_method_id
1. Validate plan_name in (free, core, personal)
2. Validate client not already subscribed (or upgrading)
3. If plan_name == "free":
   - Create subscription directly
   - No Stripe call
4. Else (core or personal):
   - Call Stripe API to create subscription
   - Store stripe_subscription_id + stripe_customer_id
   - Store current_period_start, current_period_end
5. Update public.users.sub_status = plan_name
6. Update client.subscription_id
7. If Personal tier:
   - Mark for practitioner assignment
   - Notify Org admin
8. Log audit event: "create" entity_type="subscription"

# Webhook route: POST /api/subscriptions/webhook
# Called by: Stripe on invoice.paid, customer.subscription.updated, etc.
1. Verify webhook signature
2. Update subscription.stripe_status
3. If status == "active":
   - Update user.sub_status = "active"
4. If status == "past_due":
   - Disable upload feature
   - Notify user
5. If status == "cancelled":
   - Update subscription.status = "cancelled"
   - Update user.sub_status = "cancelled"
   - Preserve data but lock write access
6. If period renewed:
   - Update current_period_end
```

---

## 6. ROW-LEVEL SECURITY (RLS) POLICIES

```sql
-- Practitioners can see clients assigned to them
CREATE POLICY "Practitioners: read assigned clients"
  ON public.clients FOR SELECT
  USING (
    assigned_practitioner_id = (
      SELECT id FROM public.practitioners WHERE user_id = auth.uid()
    )
  );

-- Org admins can see org members' clients
CREATE POLICY "Org admins: read org clients"
  ON public.clients FOR SELECT
  USING (
    user_id IN (
      SELECT u.id FROM public.users u
      JOIN public.organization_members om ON om.user_id = u.id
      WHERE om.organization_id = (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND org_role = 'admin'
      )
    )
  );

-- Users can see their own subscriptions
CREATE POLICY "Users: see own subscription"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Questionnaire responses visible only to client + practitioner + admins
CREATE POLICY "Questionnaires: client sees own responses"
  ON public.client_questionnaires FOR SELECT
  USING (
    client_id = (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
    OR
    -- practitioner sees assigned client's responses
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_questionnaires.client_id
      AND c.assigned_practitioner_id = (
        SELECT id FROM public.practitioners WHERE user_id = auth.uid()
      )
    )
  );
```

---

## 7. INTEGRATION POINTS

### 7.1 Stripe Integration

**Subscribing to a Plan**

```
Frontend → FastAPI POST /api/subscriptions
  {
    "plan_name": "personal",
    "payment_method_id": "pm_xxxxx"
  }
→ Backend calls Stripe API → Stripe returns subscription_id
→ Backend stores in public.subscriptions
→ Backend updates user.sub_status
→ Stripe sends webhook on completion → Backend updates status
```

**Webhook Handling (Idempotent)**

```
Stripe webhook POST /api/subscriptions/webhook
→ Verify signature
→ Parse event (invoice.paid, subscription.updated, etc.)
→ Upsert subscription record
→ Sync user.sub_status
→ Log to audit_logs
```

### 7.2 AI/LLM Integration (Existing)

**Program Recommendation**

```
After onboarding questionnaire completion:
→ Backend calls Claude API with:
  - Questionnaire responses
  - Any recent lab uploads + biomarkers
  - User health goals/symptoms
→ LLM returns: suggested_program_id + reasoning
→ Backend stores in client_questionnaires.result_notes
→ Frontend offers "Assign [Program Name]" button
```

### 7.3 Notification System (Future)

**Events that Trigger Notifications**

```
1. Onboarding complete → Send "Choose your plan"
2. Program assigned → Send "Your program is ready"
3. Practitioner assigned → Send "Meet your specialist"
4. Protocol adjusted → Send "Your protocol was updated"
5. Check-in due → Send "Weekly check-in reminder"
6. Subscription expiring → Send "Renew your plan"
```

**Channels**

- Email (primary)
- In-app notifications (future)
- SMS (future, opt-in)

---

## 8. DATA FLOW DIAGRAM

### Signup → Onboarding → Program → Execution

```
User Signup (POST /auth/register)
    ↓
Supabase auth trigger
    ├→ CREATE users row
    ├→ CREATE clients row (onboarding_status=started)
    ├→ CREATE subscription (plan=free)
    └→ Log audit event
    ↓
User logs in, navigates to /onboarding
    ↓
Frontend loads onboarding questionnaire
    ↓
User completes form
    ↓
Frontend POST /api/questionnaires/:id/submit
    ↓
Backend validates + scores
    ├→ CREATE client_questionnaires row
    ├→ Call LLM for suggested_program
    ├→ UPDATE client.onboarding_status = program_assigned
    └→ Log audit event
    ↓
Frontend shows "Start [Program Name]"
    ↓
User clicks to start (or upgrades subscription first)
    ↓
Frontend POST /api/client-programs
    ↓
Backend creates client_programs assignment
    ├→ UPDATE client.active_program_id
    ├→ UPDATE client.onboarding_status = active
    ├→ Schedule checkpoint reminders
    └→ Log audit event
    ↓
User starts uploading labs + logging symptoms
    ↓
[For Personal tier only]
Org admin assigns practitioner
    ↓
Backend updates client.assigned_practitioner_id
    ├→ Increment practitioner.current_clients
    └→ Log audit event
    ↓
Practitioner reviews uploads + adjusts protocol
    ↓
Client receives weekly check-in reminders
    ↓
Client logs progress in check-in form
    ↓
Backend stores response + flags for practitioner review
    ↓
Cycle repeats until program completion
```

---

## 9. IMPLEMENTATION ROADMAP

### Phase 1: Core Tables (Week 1-2)

- [ ] Create database migrations (SQL files)
- [ ] Add RLS policies
- [ ] Create indexes

### Phase 2: Backend API (Week 2-4)

- [ ] Implement client endpoints
- [ ] Implement program endpoints
- [ ] Implement questionnaire endpoints
- [ ] Implement subscription endpoints
- [ ] Add Stripe webhook handler
- [ ] Add audit logging

### Phase 3: CRM UI (Week 4-6)

- [ ] Org admin dashboard (clients, programs, members)
- [ ] Practitioner dashboard (assigned clients, check-ins)
- [ ] Client profile views (edit, track progress)
- [ ] Program management interface
- [ ] Questionnaire builder (Admin only)

### Phase 4: End-User Experience (Week 6-8)

- [ ] Onboarding flow refinement
- [ ] Program dashboard
- [ ] Weekly check-in interface
- [ ] Progress tracking visualizations
- [ ] Notification system

### Phase 5: Optimization & Hardening (Week 8+)

- [ ] Performance tuning (indexes, query optimization)
- [ ] Security audit (RLS edge cases)
- [ ] Load testing
- [ ] Documentation

---

## 10. DATABASE MIGRATION SCRIPT

**File: `backend/sql/stage-5-crm-core.sql`**

```sql
-- VITALOOP Stage 5: CRM Core Tables
-- Execute after existing migrations in order

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Practitioners
CREATE TABLE public.practitioners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  specialization TEXT NOT NULL DEFAULT 'general'
    CHECK (specialization IN ('nutrition', 'biohacking', 'performance', 'general')),
  bio TEXT,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'onboarding')),
  availability TEXT DEFAULT 'available'
    CHECK (availability IN ('available', 'booked', 'unavailable')),
  max_clients SMALLINT DEFAULT 20,
  current_clients SMALLINT DEFAULT 0,
  hourly_rate_cents INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_practitioners_user_id ON public.practitioners(user_id);
CREATE INDEX idx_practitioners_status ON public.practitioners(status);

-- 2. Programs
CREATE TABLE public.programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'wellness'
    CHECK (category IN ('metabolic-optimization', 'longevity', 'athletic-performance', 'wellness', 'custom')),
  duration_days INT CHECK (duration_days > 0),
  template_protocol JSONB,
  biomarker_targets JSONB,
  checkpoint_intervals INT[] DEFAULT '{7,14,30,60,90}',
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'deprecated', 'archived')),
  created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_programs_category ON public.programs(category);
CREATE INDEX idx_programs_status ON public.programs(status);

-- 3. Clients
CREATE TABLE public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  assigned_practitioner_id UUID REFERENCES public.practitioners(id) ON DELETE SET NULL,
  onboarding_status TEXT DEFAULT 'started'
    CHECK (onboarding_status IN ('started', 'questionnaire_pending', 'program_assigned', 'active', 'paused', 'completed')),
  active_program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions ON DELETE SET NULL,
  last_upload_at TIMESTAMPTZ,
  last_check_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_clients_practitioner_id ON public.clients(assigned_practitioner_id);
CREATE INDEX idx_clients_active_program_id ON public.clients(active_program_id);
CREATE INDEX idx_clients_subscription_id ON public.clients(subscription_id);
CREATE INDEX idx_clients_onboarding_status ON public.clients(onboarding_status);

-- 4. Client Programs
CREATE TABLE public.client_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE RESTRICT NOT NULL,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  started_date TIMESTAMPTZ,
  projected_end_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  checkpoint_progress JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_programs_client_id ON public.client_programs(client_id);
CREATE INDEX idx_client_programs_program_id ON public.client_programs(program_id);
CREATE INDEX idx_client_programs_status ON public.client_programs(status);
CREATE UNIQUE INDEX uq_client_programs_active ON public.client_programs(client_id)
  WHERE status IN ('active', 'paused');

-- 5. Questionnaires
CREATE TABLE public.questionnaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_type TEXT DEFAULT 'onboarding'
    CHECK (template_type IN ('onboarding', 'progress-check', 'program-specific', 'symptom-tracker')),
  questions JSONB NOT NULL,
  scoring_logic JSONB,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'draft', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questionnaires_template_type ON public.questionnaires(template_type);
CREATE INDEX idx_questionnaires_program_id ON public.questionnaires(program_id);

-- 6. Client Questionnaires
CREATE TABLE public.client_questionnaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  questionnaire_id UUID REFERENCES public.questionnaires(id) ON DELETE RESTRICT NOT NULL,
  responses JSONB NOT NULL,
  score NUMERIC(5,2),
  result_notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_questionnaires_client_id ON public.client_questionnaires(client_id);
CREATE INDEX idx_client_questionnaires_questionnaire_id ON public.client_questionnaires(questionnaire_id);
CREATE INDEX idx_client_questionnaires_completed_at ON public.client_questionnaires(completed_at DESC);

-- 7. Subscriptions
CREATE TABLE public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  plan_name TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_name IN ('free', 'core', 'personal')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'past_due')),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_status TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_plan_name ON public.subscriptions(plan_name);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);

-- 8. Audit Logs
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL DEFAULT 'create'
    CHECK (action IN ('create', 'read', 'update', 'delete', 'assign', 'reassign')),
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('client', 'practitioner', 'program', 'subscription', 'questionnaire', 'client_program')),
  entity_id UUID NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS on new tables
ALTER TABLE public.practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies will be added in separate file
```

---

## 11. TECHNICAL NOTES

### Schema Design Decisions

1. **Practitioners as separate entity**: Allows practitioners to have their own profile, availability, and capacity management. Not all users will be practitioners.

2. **Programs as templates**: Reusable protocol templates. Specific adjustments stored per client_program.

3. **Questionnaires with JSONB**: Flexible schema allows for different question types, scoring logic, and branching without schema changes.

4. **client_programs junction table**: Tracks program assignments with status and progress, allowing clients to complete multiple programs over time.

5. **Subscriptions separate from users**: Allows fine-grained access control and supports multiple subscription histories (cancellation + resubscribe).

6. **Audit logs**: Full audit trail for compliance and debugging. JSONB changes field for detailed mutation history.

### Performance Considerations

1. **Indexes on foreign keys** + **status fields**: Most queries filter by status or join on user_id.
2. **UNIQUE constraints** where appropriate: client_id:questionnaire_id prevents duplicates during resubmission.
3. **Archive strategy**: Status fields allow soft-delete (archive) rather than hard deletes, preserving referential integrity.

### Security Considerations

1. **RLS enforced at database level**: Policies in separate migration for clarity and auditability.
2. **Audit logs immutable**: INSERT-only table, no UPDATE/DELETE permissions for app role.
3. **Stripe secrets**: Never stored in DB; managed via environment variables and vaults.

---

## 12. FUTURE ENHANCEMENTS

- **Progress visualization**: Biomarker trend charts, goal tracking dashboards
- **Notification engine**: Scheduled check-in reminders, milestone celebrations
- **Mobile app**: Native iOS/Android with offline support
- **API webhooks**: Allow third-party integrations (e.g., wearable devices)
- **Machine learning**: Predict optimal program based on historical outcomes
- **Marketplace**: Practitioners can list availability, clients can book sessions
- **Integrations**: Apple Health, Fitbit, Oura Ring data sync

---

**END OF STAGE 5 CRM CORE DESIGN**
