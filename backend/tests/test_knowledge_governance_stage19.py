import pytest
from fastapi import HTTPException

from app.services.knowledge import governance


class _Resp:
    def __init__(self, data=None):
        self.data = data or []


class _TableRecorder:
    def __init__(self):
        self.insert_payload = None
        self.update_calls = []

    def insert(self, payload):
        self.insert_payload = payload
        return self

    def update(self, payload):
        self.update_calls.append(payload)
        return self

    def select(self, _columns):
        return self

    def eq(self, *_args):
        return self

    def neq(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        if self.insert_payload is not None:
            payload = dict(self.insert_payload)
            payload.setdefault('id', 'new-rule-id')
            return _Resp([payload])
        if self.update_calls:
            payload = dict(self.update_calls[-1])
            payload.setdefault('id', 'rule-id')
            payload.setdefault('governance_status', payload.get('governance_status', 'active'))
            payload.setdefault('active', payload.get('active', False))
            return _Resp([payload])
        return _Resp([])


class _ClientRecorder:
    def __init__(self):
        self.knowledge_rules = _TableRecorder()

    def table(self, table_name):
        if table_name == 'knowledge_rules':
            return self.knowledge_rules
        return _TableRecorder()


@pytest.mark.asyncio
async def test_create_draft_copy_creates_version_plus_one(monkeypatch):
    client = _ClientRecorder()

    async def _fake_run(fn):
        return fn()

    async def _fake_load_rule(_rule_id):
        return {
            'id': 'active-rule-id',
            'key': 'rule_low_ferritin_fatigue',
            'name': 'Low ferritin with fatigue',
            'description': 'desc',
            'input_entities': ['ferritin', 'fatigue'],
            'conditions': {'all': [{'lab_marker': 'ferritin', 'operator': 'lt', 'value': 30, 'unit': 'ng/mL'}]},
            'outputs': {'risk': 'possible_iron_deficiency_risk', 'recommendation_keys': ['iron_followup_discussion']},
            'confidence': 0.72,
            'severity': 'moderate',
            'requires_doctor': False,
            'explanation_template': 'template',
            'source': 'clinical_guideline_placeholder',
            'source_url': 'https://example.org/source',
            'governance_status': 'active',
            'version': 'v5',
            'auto_update_allowed': False,
        }

    events = []

    async def _fake_audit(**kwargs):
        events.append(kwargs)

    async def _fake_supports_copy_columns():
        return True

    monkeypatch.setattr(governance, '_load_rule', _fake_load_rule)
    monkeypatch.setattr(governance, '_supports_rule_copy_columns', _fake_supports_copy_columns)
    monkeypatch.setattr(governance.supabase, '_get_supabase', lambda: client)
    monkeypatch.setattr(governance.supabase, '_run', _fake_run)
    monkeypatch.setattr(governance.supabase, 'write_audit_log', _fake_audit)

    created = await governance.create_draft_copy(
        'active-rule-id',
        {'last_modified_by': '11111111-1111-1111-1111-111111111111', 'change_note': 'copy for stage19'},
        actor_user_id='11111111-1111-1111-1111-111111111111',
    )

    assert created['governance_status'] == 'draft'
    assert created['active'] is False
    assert created['version'] == 'v6'
    assert created['copied_from_rule_id'] == 'active-rule-id'
    assert created['copied_from_version'] == 'v5'
    assert len(events) == 1


@pytest.mark.asyncio
async def test_active_rule_cannot_be_edited_directly(monkeypatch):
    async def _fake_load_rule(_rule_id):
        return {
            'id': 'rule-id',
            'governance_status': 'active',
            'explanation_template': 'template',
            'outputs': {'risk': 'risk'},
            'source': 'source',
            'source_url': 'https://example.org/source',
        }

    monkeypatch.setattr(governance, '_load_rule', _fake_load_rule)

    with pytest.raises(HTTPException) as ex:
        await governance.update_rule(
            'rule-id',
            {
                'name': 'updated',
                'last_modified_by': '11111111-1111-1111-1111-111111111111',
                'change_note': 'attempt direct edit',
            },
            actor_user_id='11111111-1111-1111-1111-111111111111',
        )

    assert ex.value.status_code == 409


@pytest.mark.asyncio
async def test_approve_deprecates_previous_active_same_key(monkeypatch):
    client = _ClientRecorder()

    async def _fake_run(fn):
        return fn()

    async def _fake_load_rule(_rule_id):
        return {
            'id': 'reviewed-id',
            'key': 'rule_low_ferritin_fatigue',
            'governance_status': 'reviewed',
        }

    async def _fake_audit(**_kwargs):
        return None

    monkeypatch.setattr(governance, '_load_rule', _fake_load_rule)
    monkeypatch.setattr(governance.supabase, '_get_supabase', lambda: client)
    monkeypatch.setattr(governance.supabase, '_run', _fake_run)
    monkeypatch.setattr(governance.supabase, 'write_audit_log', _fake_audit)

    updated = await governance.approve_rule(
        'reviewed-id',
        {
            'medical_reviewed_by': '11111111-1111-1111-1111-111111111111',
            'medical_reviewed_at': '2026-06-01T12:00:00Z',
            'last_modified_by': '11111111-1111-1111-1111-111111111111',
            'change_note': 'approve copy',
        },
        actor_user_id='11111111-1111-1111-1111-111111111111',
    )

    assert len(client.knowledge_rules.update_calls) >= 2
    first_update = client.knowledge_rules.update_calls[0]
    second_update = client.knowledge_rules.update_calls[1]
    assert first_update['governance_status'] == 'deprecated'
    assert second_update['governance_status'] == 'active'
    assert updated['governance_status'] == 'active'


@pytest.mark.asyncio
async def test_invalid_conditions_rejected():
    with pytest.raises(HTTPException) as ex:
        await governance.create_rule(
            {
                'key': 'rule_invalid_conditions',
                'name': 'Invalid conditions',
                'conditions': {'unexpected': []},
                'outputs': {'risk': 'possible_risk'},
                'explanation_template': 'text',
                'source': 'source',
                'source_url': 'https://example.org/source',
                'last_modified_by': '11111111-1111-1111-1111-111111111111',
                'change_note': 'create draft',
            },
            actor_user_id='11111111-1111-1111-1111-111111111111',
        )

    assert ex.value.status_code == 400
    assert 'all or any' in str(ex.value.detail)


@pytest.mark.asyncio
async def test_invalid_operator_rejected():
    # "between" used to be this test's example of a rejected operator, but it
    # is a real operator evaluator.py has always implemented (see
    # test_between_operator_is_allowed) — governance's validator just hadn't
    # caught up. Using a genuinely nonexistent operator here instead.
    with pytest.raises(HTTPException) as ex:
        await governance.create_rule(
            {
                'key': 'rule_invalid_operator',
                'name': 'Invalid operator',
                'conditions': {'all': [{'lab_marker': 'ferritin', 'operator': 'roughly', 'value': 30}]},
                'outputs': {'risk': 'possible_risk'},
                'explanation_template': 'text',
                'source': 'source',
                'source_url': 'https://example.org/source',
                'last_modified_by': '11111111-1111-1111-1111-111111111111',
                'change_note': 'create draft',
            },
            actor_user_id='11111111-1111-1111-1111-111111111111',
        )

    assert ex.value.status_code == 400
    assert 'Unsupported operator' in str(ex.value.detail)


@pytest.mark.asyncio
async def test_forbidden_medical_wording_rejected():
    with pytest.raises(HTTPException) as ex:
        await governance.create_rule(
            {
                'key': 'rule_forbidden_wording',
                'name': 'Diagnosis confirmed for iron deficiency',
                'conditions': {'all': [{'lab_marker': 'ferritin', 'operator': 'lt', 'value': 30}]},
                'outputs': {'risk': 'possible_risk', 'summary': 'diagnosis confirmed due to ferritin'},
                'explanation_template': 'Confirmed diagnosis',
                'source': 'source',
                'source_url': 'https://example.org/source',
                'last_modified_by': '11111111-1111-1111-1111-111111111111',
                'change_note': 'create draft',
            },
            actor_user_id='11111111-1111-1111-1111-111111111111',
        )

    assert ex.value.status_code == 400
    assert 'Medical rule wording' in str(ex.value.detail)


def test_symptom_shorthand_condition_is_allowed():
    governance._validate_conditions_schema(
        {
            'all': [
                {'lab_marker': 'ferritin', 'operator': 'lt', 'value': 30, 'unit': 'ng/mL'},
                {'symptom': 'fatigue'},
            ]
        }
    )


def test_between_operator_is_allowed():
    # evaluator.py (the runtime rule engine) has always supported "between"
    # (e.g. rule_prediabetes_hba1c: value=[5.7, 6.4]); governance's validator
    # didn't list it until 2026-09-03, so any create_draft_copy/update_rule
    # call touching one of those rules' conditions would have been rejected.
    governance._validate_conditions_schema(
        {'all': [{'lab_marker': 'hba1c', 'operator': 'between', 'value': [5.7, 6.4], 'unit': '%'}]}
    )


@pytest.mark.asyncio
async def test_update_rule_succeeds_on_draft_without_touching_conditions(monkeypatch):
    # Regression test: update_rule()'s validation-only next_payload dict was
    # missing "conditions", so _validate_conditions_schema(None) rejected
    # EVERY update_rule call ("conditions must be an object") regardless of
    # what the caller actually changed — found 2026-09-03 while staging KB
    # source-citation fixes. No prior test exercised a successful draft edit;
    # test_active_rule_cannot_be_edited_directly only covers the blocked path.
    client = _ClientRecorder()

    async def _fake_run(fn):
        return fn()

    existing_rule = {
        'id': 'draft-rule-id',
        'name': 'Low ferritin with fatigue',
        'description': 'desc',
        'input_entities': ['ferritin', 'fatigue'],
        'conditions': {'all': [{'lab_marker': 'ferritin', 'operator': 'lt', 'value': 30, 'unit': 'ng/mL'}]},
        'outputs': {'risk': 'possible_iron_deficiency_risk', 'recommendation_keys': ['iron_followup_discussion']},
        'confidence': 0.72,
        'severity': 'moderate',
        'requires_doctor': False,
        'explanation_template': 'template',
        'source': 'clinical_guideline_placeholder',
        'source_url': 'https://example.org/source',
        'governance_status': 'draft',
        'version': 'v2',
        'auto_update_allowed': False,
    }

    async def _fake_load_rule(_rule_id):
        return existing_rule

    events = []

    async def _fake_audit(**kwargs):
        events.append(kwargs)

    monkeypatch.setattr(governance, '_load_rule', _fake_load_rule)
    monkeypatch.setattr(governance.supabase, '_get_supabase', lambda: client)
    monkeypatch.setattr(governance.supabase, '_run', _fake_run)
    monkeypatch.setattr(governance.supabase, 'write_audit_log', _fake_audit)

    updated = await governance.update_rule(
        'draft-rule-id',
        {
            # Only touching source/source_url — conditions is untouched, and
            # must still pass validation via the existing value from _load_rule.
            'source': 'internal_kb_v2_seed_pending_citation',
            'source_url': 'internal://kb-v2-seed/pending-citation',
            'last_modified_by': '11111111-1111-1111-1111-111111111111',
            'change_note': 'fix placeholder citation',
        },
        actor_user_id='11111111-1111-1111-1111-111111111111',
    )

    assert updated['source'] == 'internal_kb_v2_seed_pending_citation'
    assert len(events) == 1
