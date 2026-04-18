from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import get_settings
from app.database import engine, Base
from app.routers import (
    auth, bank_accounts, incomes, expenses, liabilities,
    investments, debts, budgets, cashflow, savings, dashboard, reports,
)

settings = get_settings()
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="FinancialControl API",
    description="Sistema pessoal de controlo financeiro — secure-by-design",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"
    return response


# Global error handler — never expose internals
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Erro interno do servidor"},
    )


# Register all routers
app.include_router(auth.router)
app.include_router(bank_accounts.router)
app.include_router(incomes.router)
app.include_router(expenses.router)
app.include_router(liabilities.router)
app.include_router(investments.router)
app.include_router(debts.router)
app.include_router(budgets.router)
app.include_router(cashflow.router)
app.include_router(savings.router)
app.include_router(dashboard.router)
app.include_router(reports.router)


@app.get("/", tags=["Sistema"])
async def root():
    return {"message": "FinancialControl API online"}


@app.get("/health", tags=["Sistema"])
async def health():
    return {"status": "ok"}
