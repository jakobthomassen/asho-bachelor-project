from __future__ import annotations

from pydantic import BaseModel, Field


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: int
    updated_at: int


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]


class ConversationCreateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1)


class ConversationUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1)


class ConversationMessage(BaseModel):
    id: str
    role: str
    text: str
    created_at: int


class ConversationMessagesResponse(BaseModel):
    messages: list[ConversationMessage]
