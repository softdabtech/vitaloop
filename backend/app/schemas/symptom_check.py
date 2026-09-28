"""Public request contracts for the structured symptom check.

All medical input is selected from controlled identifiers. Free-text clinical
answers are deliberately absent from these schemas.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


SymptomLocale = Literal["en", "uk"]
OverallWellbeing = Literal["good", "mostly_good", "reduced", "poor"]
PrimaryConcernId = Literal[
    "no_current_concern",
    "fatigue_low_energy",
    "sleep_unrefreshing",
    "cognition_memory",
    "mood_stress",
    "weight_appetite_thirst_urination",
    "digestion_stool",
    "palpitations_breathlessness_exercise",
    "muscle_weakness_cramps_numbness",
    "hair_skin_nails_temperature",
    "pain_joints_inflammation",
    "menstrual_bleeding_reproductive",
    "unsupported_concern",
]
DurationBucket = Literal[
    "today",
    "days_2_7",
    "weeks_1_4",
    "months_1_3",
    "months_3_plus",
    "intermittent",
    "unknown",
]
EvidenceChoice = Literal["present", "absent", "unknown"]


class CreateSymptomSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overall_wellbeing: OverallWellbeing
    primary_concern_id: PrimaryConcernId
    locale: SymptomLocale = "en"


class InitialEvidenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    primary_concept_id: str = Field(..., min_length=2, max_length=100)
    secondary_concept_ids: list[str] = Field(default_factory=list, max_length=2)
    duration_bucket: DurationBucket

    @model_validator(mode="after")
    def validate_controlled_selection(self):
        if self.primary_concept_id in self.secondary_concept_ids:
            raise ValueError("primary concept cannot also be secondary")
        if len(set(self.secondary_concept_ids)) != len(self.secondary_concept_ids):
            raise ValueError("secondary concepts must be unique")
        return self


class SymptomAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    item_id: str = Field(..., min_length=2, max_length=100)
    choice_id: EvidenceChoice


class SubmitSymptomAnswersRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str = Field(..., min_length=3, max_length=150)
    answers: list[SymptomAnswer] = Field(..., min_length=1, max_length=25)

    @model_validator(mode="after")
    def validate_unique_items(self):
        item_ids = [answer.item_id for answer in self.answers]
        if len(set(item_ids)) != len(item_ids):
            raise ValueError("answer item IDs must be unique")
        return self
