from pydantic import BaseModel, Field


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., min_length=1, description="Google ID token credential")


class GoogleAuthResponse(BaseModel):
    user_id: str
    session_token: str
