from pydantic import BaseModel, Field

class SimpleChatRequest(BaseModel):
    conversation_id: str = Field(..., min_length=1, description="Durable conversation identifier")
    session_id: str = Field(..., min_length=1, description="Ephemeral client/session identifier")
    message_id: str = Field(..., min_length=1, description="Idempotency key per message")
    message: str = Field(..., min_length=1, description="User message content")

class SimpleChatResponse(BaseModel):
    reply: str
