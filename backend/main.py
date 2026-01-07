from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Hello API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "Hello from Render"}

@app.get("/health")
def health():
    return {"alive": True}

@app.get("/echo/{text}")
def echo(text: str):
    return {"echo": text}
