from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db
from models import User
from auth import (
    verify_password, hash_password, create_access_token,
    get_current_user, require_admin, UserOut, UserCreate
)

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.username == form_data.username, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": user.username, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "role": user.role, "username": user.username}

@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user

from pydantic import BaseModel
class ThemeUpdate(BaseModel):
    theme: str

@router.put("/me/theme")
async def update_theme(
    payload: ThemeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import text
    if payload.theme not in ["dark", "light"]:
        raise HTTPException(status_code=400, detail="Invalid theme")
    await db.execute(
        text("UPDATE app_users SET theme = :theme WHERE id = :uid"),
        {"theme": payload.theme, "uid": current_user.id},
    )
    await db.commit()
    return {"ok": True, "theme": payload.theme}

# ── Admin: user management ────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
async def list_users(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).order_by(User.id))
    return result.scalars().all()

@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    # Verificar que no existe
    exists = await db.execute(select(func.count()).where(User.username == payload.username))
    if exists.scalar() > 0:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
    if payload.role not in ("admin", "viewer", "sostenedor", "establecimiento"):
        raise HTTPException(status_code=400, detail="El rol debe ser 'admin', 'viewer', 'sostenedor' o 'establecimiento'")
    if payload.role == "sostenedor" and not payload.sost_id:
        raise HTTPException(status_code=400, detail="El rol 'sostenedor' requiere un sost_id")
    if payload.role == "establecimiento" and not payload.rbd_id:
        raise HTTPException(status_code=400, detail="El rol 'establecimiento' requiere un rbd_id")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        sost_id=payload.sost_id if payload.role == "sostenedor" else None,
        rbd_id=payload.rbd_id if payload.role == "establecimiento" else None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await db.delete(user)
    await db.commit()
