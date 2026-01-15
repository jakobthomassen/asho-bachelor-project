import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import chat_router, debug_router, prompt_trace_router
from app.core.config import settings

app = FastAPI(title="AI Chat Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(",") if settings.ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api")
app.include_router(debug_router, prefix="/api")
app.include_router(prompt_trace_router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok"}

print("BOOTSTRAPPED VERSION 2025-01-12-PROMPT-TRACE")
print("RUNNING BUILD", os.getenv("RENDER_GIT_COMMIT"))
