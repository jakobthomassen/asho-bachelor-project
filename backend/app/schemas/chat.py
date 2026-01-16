from pydantic import BaseModel
from typing import List

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    chat_id: str
    message_id: str
    messages: List[ChatMessage]

class ChatResponse(BaseModel):
    reply: str

