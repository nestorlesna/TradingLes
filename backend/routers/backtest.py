from fastapi import APIRouter, Depends
from auth.dependencies import get_current_user
from auth.models import User

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


@router.get("/list")
async def list_backtests(current_user: User = Depends(get_current_user)):
    return {"items": [], "total": 0}
