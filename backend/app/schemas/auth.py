from pydantic import BaseModel, Field


class GoogleAuthRequest(BaseModel):
    credential: str = Field(..., min_length=1, description="Google ID token credential")


class GoogleAuthResponse(BaseModel):
    user_id: str
    session_token: str
    is_admin: bool


class AuthMeResponse(BaseModel):
    user_id: str
    is_admin: bool


class AppleAuthStartResponse(BaseModel):
    authorization_url: str


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=8, max_length=1024)


class RegisterResponse(BaseModel):
    user_id: str
    requires_email_verification: bool
    verification_token: str | None = None


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    password: str = Field(..., min_length=1, max_length=1024)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=12, max_length=512)
    new_password: str = Field(..., min_length=8, max_length=1024)


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=12, max_length=512)


class GenericAuthMessageResponse(BaseModel):
    message: str
