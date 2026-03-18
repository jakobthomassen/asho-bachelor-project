from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TopicDashboardTopic(BaseModel):
    topic_key: str
    title: str
    version_no: int
    is_current: bool
    classifier_description: str
    classifier_embedding: list[float] | None = None
    system_prompt: str
    micro_instructions: dict[str, Any]
    constraints: dict[str, Any]
    reclassify_rules: dict[str, Any]
    safety_rules: dict[str, Any]
    min_confidence: float
    reclassify_turn_threshold: int
    max_clarifying_questions: int
    updated_at: datetime | None = None


class TopicDashboardListResponse(BaseModel):
    topics: list[TopicDashboardTopic]


class TopicDashboardDailyTokens(BaseModel):
    day: str
    total_tokens: int


class TopicDashboardStatsResponse(BaseModel):
    total_unique_users: int
    total_conversations: int
    avg_conversations_per_user: float
    avg_conversation_length_messages: float
    monthly_estimated_token_cost_usd: float
    total_estimated_token_cost_usd: float
    daily_tokens: list[TopicDashboardDailyTokens]


class TopicDashboardUpdateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    classifier_description: str = Field(..., min_length=1)
    system_prompt: str = Field(..., min_length=1)
    micro_instructions: dict[str, Any] = Field(default_factory=dict)
    constraints: dict[str, Any] = Field(default_factory=dict)
    reclassify_rules: dict[str, Any] = Field(default_factory=dict)
    safety_rules: dict[str, Any] = Field(default_factory=dict)
    min_confidence: float = Field(..., ge=0.0, le=1.0)
    reclassify_turn_threshold: int = Field(..., ge=1)
    max_clarifying_questions: int = Field(..., ge=0)
    created_by: str | None = None


class SecurityRejectionItem(BaseModel):
    id: int
    conversation_id: str | None = None
    session_id: str | None = None
    message_id: str | None = None
    user_id: str | None = None
    message_preview: str | None = None
    rejection_type: str
    created_at: str | None = None


class SecurityRejectionListResponse(BaseModel):
    rejections: list[SecurityRejectionItem]


class TopicDashboardCreateRequest(BaseModel):
    topic_key: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    classifier_description: str = Field(..., min_length=1)
    system_prompt: str = Field(..., min_length=1)
    micro_instructions: dict[str, Any] = Field(default_factory=dict)
    constraints: dict[str, Any] = Field(default_factory=dict)
    reclassify_rules: dict[str, Any] = Field(default_factory=dict)
    safety_rules: dict[str, Any] = Field(default_factory=dict)
    min_confidence: float = Field(..., ge=0.0, le=1.0)
    reclassify_turn_threshold: int = Field(..., ge=1)
    max_clarifying_questions: int = Field(..., ge=0)
    created_by: str | None = None
