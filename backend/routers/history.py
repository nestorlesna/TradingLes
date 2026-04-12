from fastapi import APIRouter, Depends
from auth.dependencies import get_current_user
from auth.models import User

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("/fills")
async def get_fills(current_user: User = Depends(get_current_user)):
    return {"items": [], "total": 0, "page": 1, "pages": 0}
