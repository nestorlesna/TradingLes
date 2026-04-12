from fastapi import APIRouter, Depends
from auth.dependencies import get_current_user
from auth.models import User

router = APIRouter(prefix="/api/bot", tags=["bot"])


@router.get("/status")
async def bot_status(current_user: User = Depends(get_current_user)):
    return {"session_id": None, "estado": "detenido"}
