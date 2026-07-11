"""FastAPI application entry point."""
from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)

from backend import deps
from backend.routers import bracket, live, predict, results, teams, team
from backend.routers import simulate, status, what_if, tiebreaker, calibration, final_four


@asynccontextmanager
async def lifespan(app: FastAPI):
    squad_strength = float(os.environ.get("SQUAD_STRENGTH", "0.18"))
    log.info("Loading data and building predictor (squad_strength=%s)...", squad_strength)
    deps.initialize(squad_strength=squad_strength)
    log.info("Ready.")

    scheduler_task = None
    if os.environ.get("ENABLE_SCHEDULER", "1") == "1":
        from backend.scheduler import scheduler_loop
        interval_s = int(os.environ.get("SCHEDULER_INTERVAL_MIN", "60")) * 60
        cooldown_h = float(os.environ.get("RETRAIN_COOLDOWN_HOURS", "6"))
        scheduler_task = asyncio.create_task(
            scheduler_loop(interval_s, squad_strength, cooldown_h)
        )

    yield

    if scheduler_task:
        scheduler_task.cancel()


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
app.include_router(what_if.router,     prefix="/api")
app.include_router(tiebreaker.router,  prefix="/api")
app.include_router(calibration.router, prefix="/api")
app.include_router(status.router,      prefix="/api")
app.include_router(final_four.router,  prefix="/api")

# Serve built React frontend in production (when frontend/dist exists)
_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
