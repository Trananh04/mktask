from __future__ import annotations

from typing import Any

from .schemas import AnalyzeRequest, AnalyzeResponse


def analyze_workload(request: AnalyzeRequest) -> AnalyzeResponse:
    members = [_normalize_member(member) for member in request.members]
    tasks = [_normalize_task(task) for task in request.tasks]
    warnings = _build_warnings(members)
    assignments: list[dict[str, Any]] = []

    for task in tasks:
        assignee, matched_skills = _select_assignee(members, task)
        if assignee is None:
            warnings.append(f"No available member found for task {task['title']}.")
            continue

        assignee["active_task_count"] += 1
        assignee["assigned_hours"] += task["estimate_hours"]
        assignments.append(
            {
                "taskId": task["id"],
                "taskTitle": task["title"],
                "assigneeId": assignee["id"],
                "assigneeName": assignee["name"],
                "reason": (
                    f"Matched {matched_skills} required skill(s) with the lowest projected workload."
                ),
            }
        )

    if tasks:
        analysis = (
            f"Analyzed {len(members)} member(s) and {len(tasks)} task(s). "
            f"Suggested {len(assignments)} assignment(s)."
        )
    else:
        analysis = f"Analyzed {len(members)} member(s). No tasks to assign."

    return AnalyzeResponse(analysis=analysis, assignments=assignments, warnings=warnings)


def _select_assignee(
    members: list[dict[str, Any]], task: dict[str, Any]
) -> tuple[dict[str, Any] | None, int]:
    if not members:
        return None, 0

    required_skills = task["required_skills"]

    def score(member: dict[str, Any]) -> tuple[int, float, int, str]:
        matched_skills = len(required_skills.intersection(member["skills"]))
        projected_hours = member["assigned_hours"] + task["estimate_hours"]
        return (-matched_skills, projected_hours, member["active_task_count"], member["name"])

    selected = min(members, key=score)
    return selected, len(required_skills.intersection(selected["skills"]))


def _build_warnings(members: list[dict[str, Any]]) -> list[str]:
    warnings: list[str] = []

    for member in members:
        active_task_count = member["active_task_count"]
        assigned_hours = member["assigned_hours"]
        capacity_hours = member["capacity_hours"]
        if active_task_count >= 8 or assigned_hours > capacity_hours:
            warnings.append(
                f"{member['name']} is overloaded: "
                f"{active_task_count} active tasks and {assigned_hours:.1f}/{capacity_hours:.1f} hours assigned."
            )

    return warnings


def _normalize_member(member: dict[str, Any]) -> dict[str, Any]:
    member_id = str(member.get("id") or member.get("userId") or member.get("email") or "unknown")
    name = str(member.get("name") or member.get("displayName") or member_id)
    return {
        "id": member_id,
        "name": name,
        "skills": _normalize_skills(member.get("skills", [])),
        "active_task_count": _to_int(
            member.get("activeTaskCount", member.get("active_task_count", 0))
        ),
        "assigned_hours": _to_float(member.get("assignedHours", member.get("assigned_hours", 0))),
        "capacity_hours": _to_float(member.get("capacityHours", member.get("capacity_hours", 40))),
    }


def _normalize_task(task: dict[str, Any]) -> dict[str, Any]:
    task_id = str(task.get("id") or task.get("taskId") or task.get("title") or "unknown-task")
    return {
        "id": task_id,
        "title": str(task.get("title") or task_id),
        "required_skills": _normalize_skills(
            task.get("requiredSkills", task.get("required_skills", []))
        ),
        "estimate_hours": _to_float(task.get("estimateHours", task.get("estimate_hours", 1))),
    }


def _normalize_skills(value: Any) -> set[str]:
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return set()
    return {str(skill).strip().lower() for skill in value if str(skill).strip()}


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _to_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0
