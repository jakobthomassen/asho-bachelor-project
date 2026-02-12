from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class TopicDashboardTopic(BaseModel):
    topic_key: str
    title: str
    version_no: int
    is_current: bool
    classifier_description: str
    classifier_keywords: list[str]
    classifier_exclude_keywords: list[str]
    system_prompt: str
    micro_instructions: dict[str, Any]
    constraints: dict[str, Any]
    pacing_rules: dict[str, Any]
    reclassify_rules: dict[str, Any]
    safety_rules: dict[str, Any]
    min_confidence: float
    reclassify_turn_threshold: int
    max_clarifying_questions: int
    examples: list[Any]


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
    classifier_keywords: list[str] = Field(default_factory=list)
    classifier_exclude_keywords: list[str] = Field(default_factory=list)
    system_prompt: str = Field(..., min_length=1)
    micro_instructions: dict[str, Any] = Field(default_factory=dict)
    constraints: dict[str, Any] = Field(default_factory=dict)
    pacing_rules: dict[str, Any] = Field(default_factory=dict)
    reclassify_rules: dict[str, Any] = Field(default_factory=dict)
    safety_rules: dict[str, Any] = Field(default_factory=dict)
    min_confidence: float = Field(..., ge=0.0, le=1.0)
    reclassify_turn_threshold: int = Field(..., ge=1)
    max_clarifying_questions: int = Field(..., ge=0)
    examples: list[Any] = Field(default_factory=list)
    created_by: str | None = None
