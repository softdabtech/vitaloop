from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


EvidenceChoice = Literal["present", "absent", "unknown"]
EvidenceSource = Literal["initial", "suggest", "red_flags", "diagnosis", "predefined"]


class ProviderAge(BaseModel):
    value: int = Field(..., ge=18, le=120)
    unit: Literal["year"] = "year"


class ProviderEvidence(BaseModel):
    id: str = Field(..., min_length=2, max_length=100)
    choice_id: EvidenceChoice
    source: EvidenceSource | None = None


class ProviderCaseRequest(BaseModel):
    # This is the complete outbound data contract. Forbid extra fields so a
    # caller cannot accidentally send account identity, free text, lab data,
    # or other health-profile attributes to the symptom provider.
    model_config = ConfigDict(extra="forbid")

    sex: Literal["female", "male"]
    age: ProviderAge
    evidence: list[ProviderEvidence] = Field(default_factory=list)


class ProviderChoice(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: EvidenceChoice
    label: str


class ProviderQuestionItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    choices: list[ProviderChoice] = Field(default_factory=list)


class ProviderQuestion(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: Literal["single", "group_single", "group_multiple"]
    text: str
    items: list[ProviderQuestionItem] = Field(default_factory=list)
    extras: dict[str, Any] = Field(default_factory=dict)


class ProviderDiagnosisResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    question: ProviderQuestion | None = None
    should_stop: bool = False
    conditions: list[dict[str, Any]] = Field(default_factory=list)


class ProviderTriageResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    triage_level: Literal[
        "emergency_ambulance", "emergency", "consultation_24", "consultation", "self_care"
    ]
    root_cause: str | None = None
    serious: list["ProviderSeriousObservation"] = Field(default_factory=list)


class ProviderSeriousObservation(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    common_name: str | None = None
    seriousness: Literal["serious", "emergency", "emergency_ambulance"]


class ProviderInfoResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    updated_at: str


class ProviderSearchItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    label: str


class ProviderSuggestion(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    name: str
    common_name: str | None = None
