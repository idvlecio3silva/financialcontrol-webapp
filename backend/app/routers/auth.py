@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já registado")

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
    )

    db.add(user)
    await db.flush()

    # ⚠️ TEMPORARIAMENTE REMOVIDO (provável origem do erro)
    # settings = FinancialSettings(user_id=user.id)
    # db.add(settings)

    await log_action(
        db,
        user_id=user.id,
        action=AuditAction.CREATE,
        entity_type="user",
        entity_id=str(user.id),
        ip_address=get_client_ip(request),
    )

    return user
