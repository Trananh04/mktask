from src.schemas import AnalyzeRequest
from src.tools import analyze_workload


def test_analyze_workload_assigns_task_to_lowest_load_member_with_matching_skill():
    request = AnalyzeRequest(
        members=[
            {"id": "linh", "name": "Linh", "skills": ["frontend"], "activeTaskCount": 4},
            {"id": "nam", "name": "Nam", "skills": ["frontend", "qa"], "activeTaskCount": 1},
        ],
        tasks=[
            {"id": "task-1", "title": "Fix login UI", "requiredSkills": ["frontend"], "estimateHours": 3}
        ],
    )

    result = analyze_workload(request)

    assert result.assignments == [
        {
            "taskId": "task-1",
            "taskTitle": "Fix login UI",
            "assigneeId": "nam",
            "assigneeName": "Nam",
            "reason": "Matched 1 required skill(s) with the lowest projected workload.",
        }
    ]


def test_analyze_workload_warns_when_member_is_overloaded():
    request = AnalyzeRequest(
        members=[
            {"id": "linh", "name": "Linh", "activeTaskCount": 9, "capacityHours": 20, "assignedHours": 24}
        ],
        tasks=[],
    )

    result = analyze_workload(request)

    assert "Linh is overloaded: 9 active tasks and 24.0/20.0 hours assigned." in result.warnings
