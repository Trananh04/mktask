export type WorkloadMemberInput = Record<string, unknown>;
export type WorkloadTaskInput = Record<string, unknown>;

export interface WorkloadAnalyzeInput {
  members: WorkloadMemberInput[];
  tasks: WorkloadTaskInput[];
  query?: string;
}

export interface WorkloadAssignment {
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  assigneeName: string;
  reason: string;
}

export interface WorkloadAnalyzeResult {
  analysis: string;
  assignments: WorkloadAssignment[];
  warnings: string[];
}

interface NormalizedMember {
  id: string;
  name: string;
  skills: Set<string>;
  activeTaskCount: number;
  assignedHours: number;
  capacityHours: number;
}

interface NormalizedTask {
  id: string;
  title: string;
  requiredSkills: Set<string>;
  estimateHours: number;
}

export function analyzeWorkload(input: WorkloadAnalyzeInput): WorkloadAnalyzeResult {
  const members = (input.members || []).map(normalizeMember);
  const tasks = (input.tasks || []).map(normalizeTask);
  const warnings = buildWarnings(members);
  const assignments: WorkloadAssignment[] = [];

  for (const task of tasks) {
    const selected = selectAssignee(members, task);
    if (!selected.member) {
      warnings.push(`Không tìm thấy thành viên phù hợp cho công việc ${task.title}.`);
      continue;
    }

    selected.member.activeTaskCount += 1;
    selected.member.assignedHours += task.estimateHours;
    assignments.push({
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: selected.member.id,
      assigneeName: selected.member.name,
      reason: `Khớp ${selected.matchedSkills} kỹ năng cần thiết và có tải việc dự kiến thấp nhất.`,
    });
  }

  return {
    analysis: tasks.length
      ? `Đã phân tích ${members.length} thành viên và ${tasks.length} công việc. Đề xuất ${assignments.length} phân công.`
      : `Đã phân tích ${members.length} thành viên. Chưa có công việc để phân công.`,
    assignments,
    warnings,
  };
}

function selectAssignee(
  members: NormalizedMember[],
  task: NormalizedTask,
): { member: NormalizedMember | null; matchedSkills: number } {
  if (!members.length) return { member: null, matchedSkills: 0 };

  const score = (member: NormalizedMember): [number, number, number, string] => {
    const matchedSkills = intersectionSize(task.requiredSkills, member.skills);
    const projectedHours = member.assignedHours + task.estimateHours;
    return [-matchedSkills, projectedHours, member.activeTaskCount, member.name];
  };

  const selected = members.reduce((best, member) => {
    const bestScore = score(best);
    const memberScore = score(member);
    return compareScore(memberScore, bestScore) < 0 ? member : best;
  });

  return {
    member: selected,
    matchedSkills: intersectionSize(task.requiredSkills, selected.skills),
  };
}

function buildWarnings(members: NormalizedMember[]): string[] {
  return members.flatMap((member) => {
    if (member.activeTaskCount >= 8 || member.assignedHours > member.capacityHours) {
      return [
        `${member.name} đang quá tải: ${member.activeTaskCount} công việc đang làm và ${member.assignedHours.toFixed(1)}/${member.capacityHours.toFixed(1)} giờ.`,
      ];
    }
    return [];
  });
}

function normalizeMember(member: WorkloadMemberInput): NormalizedMember {
  const id = firstString(member.id, member.userId, member.email) || 'unknown';
  const name = firstString(member.name, member.displayName) || id;
  return {
    id,
    name,
    skills: normalizeSkills(member.skills),
    activeTaskCount: toInt(member.activeTaskCount ?? member.active_task_count),
    assignedHours: toFloat(member.assignedHours ?? member.assigned_hours),
    capacityHours: toFloat(member.capacityHours ?? member.capacity_hours ?? 40),
  };
}

function normalizeTask(task: WorkloadTaskInput): NormalizedTask {
  const id = firstString(task.id, task.taskId, task.title) || 'unknown-task';
  return {
    id,
    title: firstString(task.title) || id,
    requiredSkills: normalizeSkills(task.requiredSkills ?? task.required_skills),
    estimateHours: toFloat(task.estimateHours ?? task.estimate_hours ?? 1),
  };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return undefined;
}

function normalizeSkills(value: unknown): Set<string> {
  const values = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
  return new Set(values.map((skill) => String(skill).trim().toLowerCase()).filter(Boolean));
}

function toFloat(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function toInt(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? Math.trunc(result) : 0;
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  left.forEach((value) => {
    if (right.has(value)) count += 1;
  });
  return count;
}

function compareScore(
  left: [number, number, number, string],
  right: [number, number, number, string],
) {
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }
  return 0;
}
