from typing import Any

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    members: list[dict[str, Any]] = Field(default_factory=list)
    tasks: list[dict[str, Any]] = Field(default_factory=list)
    query: str = "Analyze workload and recommend assignments"


class AnalyzeResponse(BaseModel):
    analysis: str
    assignments: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
