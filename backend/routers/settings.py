from fastapi import APIRouter, Depends
from auth.dependencies import get_current_user
from auth.models import User

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/wallet-info")
async def wallet_info(current_user: User = Depends(get_current_user)):
    return {
        "testnet": {"configured": False, "wallet_address": None},
        "mainnet": {"configured": False, "wallet_address": None},
    }
