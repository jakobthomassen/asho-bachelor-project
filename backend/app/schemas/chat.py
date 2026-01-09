from pydantic import BaseModel

class SimpleChatRequest(BaseModel):
    session_id: str
    message_id: str
    message: str

class SimpleChatResponse(BaseModel):
    reply: str
