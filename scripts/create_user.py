"""
Utility script to create/reset the admin user.
Usage: python scripts/create_user.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, func
from auth.models import User
from auth.security import hash_password
from config import get_settings
import uuid


async def main():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as session:
        result = await session.execute(select(func.count()).select_from(User))
        if result.scalar() > 0:
            print("Ya existe un usuario. Usa la interfaz web para cambiar la contraseña.")
            return

        username = input("Usuario: ").strip()
        password = input("Contraseña: ").strip()
        user = User(id=uuid.uuid4(), username=username, password_hash=hash_password(password))
        session.add(user)
        await session.commit()
        print(f"Usuario '{username}' creado exitosamente.")

    await engine.dispose()


asyncio.run(main())
