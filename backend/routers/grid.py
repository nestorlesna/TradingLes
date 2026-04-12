from fastapi import APIRouter, Depends
from auth.dependencies import get_current_user
from auth.models import User

router = APIRouter(prefix="/api/grid", tags=["grid"])


@router.get("/configs")
async def list_configs(current_user: User = Depends(get_current_user)):
    return []
