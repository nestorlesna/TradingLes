from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from auth.dependencies import get_current_user
from auth.models import User
from models.database import get_db
from models.app_config import AppConfig
from services.crypto import generate_salt, salt_to_hex, salt_from_hex, encrypt_key, decrypt_key

router = APIRouter(prefix="/api/settings", tags=["settings"])

# ── DB helpers ──────────────────────────────────────────────────────────────

async def _get_config(db: AsyncSession, clave: str) -> Optional[str]:
    row = await db.execute(select(AppConfig).where(AppConfig.clave == clave))
    obj = row.scalar_one_or_none()
    return obj.valor if obj else None


async def _set_config(db: AsyncSession, clave: str, valor: str) -> None:
    row = await db.execute(select(AppConfig).where(AppConfig.clave == clave))
    obj = row.scalar_one_or_none()
    if obj:
        obj.valor = valor
    else:
        db.add(AppConfig(clave=clave, valor=valor))
    await db.commit()


async def _del_config(db: AsyncSession, clave: str) -> None:
    row = await db.execute(select(AppConfig).where(AppConfig.clave == clave))
    obj = row.scalar_one_or_none()
    if obj:
        await db.delete(obj)
        await db.commit()


async def _get_or_create_salt(db: AsyncSession) -> bytes:
    """Single salt shared across all keys for this installation."""
    hex_val = await _get_config(db, "fernet_salt")
    if hex_val:
        return salt_from_hex(hex_val)
    salt = generate_salt()
    await _set_config(db, "fernet_salt", salt_to_hex(salt))
    return salt


# ── Schemas ──────────────────────────────────────────────────────────────────

class SaveKeyRequest(BaseModel):
    mode: str              # 'testnet' | 'mainnet'
    master_password: str
    private_key: str
    wallet_address: str


class VerifyPasswordRequest(BaseModel):
    mode: str
    master_password: str


class ChangePasswordRequest(BaseModel):
    mode: str
    current_password: str
    new_password: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/wallet-info")
async def wallet_info(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns configured status and wallet addresses (public info only)."""
    testnet_addr = await _get_config(db, "wallet_address_testnet")
    mainnet_addr = await _get_config(db, "wallet_address_mainnet")
    testnet_key  = await _get_config(db, "private_key_testnet")
    mainnet_key  = await _get_config(db, "private_key_mainnet")

    return {
        "testnet": {
            "configured": testnet_key is not None,
            "wallet_address": testnet_addr,
        },
        "mainnet": {
            "configured": mainnet_key is not None,
            "wallet_address": mainnet_addr,
        },
    }


@router.post("/keys")
async def save_key(
    req: SaveKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save (or overwrite) an encrypted private key for testnet or mainnet."""
    if req.mode not in ("testnet", "mainnet"):
        raise HTTPException(status_code=400, detail="mode debe ser testnet o mainnet")
    if len(req.master_password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña maestra debe tener al menos 8 caracteres")
    if not req.private_key.startswith("0x") and len(req.private_key) != 64:
        # Basic sanity check — allow 0x-prefixed or raw 64-char hex
        if not (req.private_key.startswith("0x") and len(req.private_key) == 66):
            raise HTTPException(status_code=400, detail="Private key inválida (debe ser 64 hex chars o 0x + 64)")

    salt = await _get_or_create_salt(db)
    encrypted = encrypt_key(req.private_key, req.master_password, salt)

    await _set_config(db, f"private_key_{req.mode}", encrypted)
    await _set_config(db, f"wallet_address_{req.mode}", req.wallet_address)

    return {"ok": True, "message": f"Clave {req.mode} guardada correctamente"}


@router.post("/verify-password")
async def verify_password(
    req: VerifyPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test that master_password can decrypt the stored key."""
    if req.mode not in ("testnet", "mainnet"):
        raise HTTPException(status_code=400, detail="mode inválido")

    encrypted = await _get_config(db, f"private_key_{req.mode}")
    if not encrypted:
        raise HTTPException(status_code=404, detail=f"No hay clave configurada para {req.mode}")

    salt = await _get_or_create_salt(db)
    try:
        decrypt_key(encrypted, req.master_password, salt)
    except ValueError:
        raise HTTPException(status_code=401, detail="Contraseña maestra incorrecta")

    return {"ok": True}


@router.delete("/keys/{mode}")
async def delete_key(
    mode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if mode not in ("testnet", "mainnet"):
        raise HTTPException(status_code=400, detail="mode inválido")

    await _del_config(db, f"private_key_{mode}")
    await _del_config(db, f"wallet_address_{mode}")

    return {"ok": True, "message": f"Clave {mode} eliminada"}
