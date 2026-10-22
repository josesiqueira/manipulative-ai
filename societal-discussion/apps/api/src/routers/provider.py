"""Which model provider answers now (public).

The participant app reads this to show the data protection texts of the
provider that actually receives the messages."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.llm_client import resolve_provider
from ..services.llm_models import get_model_name

router = APIRouter()


class ProviderResponse(BaseModel):
    provider: str
    model: str
    model_name: str


@router.get("", response_model=ProviderResponse)
async def get_provider(db: AsyncSession = Depends(get_db, scope="function")):
    chosen = await resolve_provider(db)
    if chosen is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="No model provider configured")
    provider, model, _ = chosen
    return ProviderResponse(provider=provider, model=model, model_name=get_model_name(provider, model))
