from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from app.dependencies import get_current_user
from app.services import claude_service

router = APIRouter()

class LLMConsultRequest(BaseModel):
    question: str
    context: str = ""

class LLMConsultResponse(BaseModel):
    answer: str

@router.post("/consult", response_model=LLMConsultResponse)
async def llm_consult(body: LLMConsultRequest, current_user: dict = Depends(get_current_user)):
    """
    Позволяет пользователю задать вопрос LLM (Claude/GPT) с медицинским контекстом.
    """
    prompt = f"User question: {body.question}\nContext: {body.context}\nGive a clear, actionable answer."
    try:
        answer = await claude_service._chat_completion(prompt, task_name="user_consult")
        return {"answer": answer.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
