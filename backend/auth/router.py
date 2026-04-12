from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime, timezone
from auth.models import User
from auth.security import hash_password, verify_password, create_access_token
from auth.dependencies import get_current_user
from models.database import get_db
import uuid

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class SetupRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    username: str


@router.get("/has-users")
async def has_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count()).select_from(User))
    count = result.scalar()
    return {"has_users": count > 0}


@router.post("/setup", status_code=status.HTTP_201_CREATED)
async def setup(body: SetupRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count()).select_from(User))
    if result.scalar() > 0:
        raise HTTPException(status_code=409, detail="Ya existe un usuario configurado")
    user = User(
        id=uuid.uuid4(),
        username=body.username,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    return {"message": "Usuario creado exitosamente"}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse(id=str(current_user.id), username=current_user.username)
