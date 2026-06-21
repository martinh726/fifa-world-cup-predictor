"""FastAPI application entry point."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from backend import deps
from backend.routers import bracket, live, predict, results, teams, team
from backend.routers import simulate


@asynccontextmanager
async def lifespan(app: FastAPI):
    squad_strength = float(os.environ.get("SQUAD_STRENGTH", "0.18"))
    print(f"[startup] Loading data and building predictor (squad_strength={squad_strength})...")
    deps.initialize(squad_strength=squad_strength)
    print("[startup] Ready.")
    yield


app = FastAPI(title="WC 2026 Predictor API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(teams.router,    prefix="/api")
app.include_router(predict.router,  prefix="/api")
app.include_router(results.router,  prefix="/api")
app.include_router(simulate.router, prefix="/api")
app.include_router(live.router,     prefix="/api")
app.include_router(bracket.router,  prefix="/api")
app.include_router(team.router,     prefix="/api")

# Serve built React frontend in production (when frontend/dist exists)
_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
