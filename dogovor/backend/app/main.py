from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import locations, staff, contracts
from app.config import settings

app = FastAPI(title="Dogovor API", version="0.1.0")

_origins = settings.cors_origins_list or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(locations.router, prefix="/api/v1", tags=["locations"])
app.include_router(staff.router, prefix="/api/v1", tags=["staff"])
app.include_router(contracts.router, prefix="/api/v1", tags=["contracts"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug/cors")
def debug_cors():
    # Не содержит секретов; помогает быстро проверить, какие origins реально применены на проде.
    return {
        "cors_origins_raw": settings.cors_origins,
        "cors_origins_list": settings.cors_origins_list,
        "middleware_allow_origins": _origins,
    }
