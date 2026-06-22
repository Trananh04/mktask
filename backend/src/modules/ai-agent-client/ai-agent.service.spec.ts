import { AiAgentService } from './ai-agent.service';

describe('AiAgentService', () => {
  it('analyzes workload locally without calling the FastAPI agent service', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const service = new AiAgentService();

    const result = await service.analyzeWorkload({
      members: [
        { id: 'member-1', name: 'An', skills: ['frontend'], activeTaskCount: 1 },
        { id: 'member-2', name: 'Binh', skills: ['backend'], activeTaskCount: 0 },
      ],
      tasks: [{ id: 'task-1', title: 'Lam UI', requiredSkills: ['frontend'] }],
      query: 'Phan cong task',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.assignments).toEqual([
      expect.objectContaining({
        taskId: 'task-1',
        assigneeId: 'member-1',
        assigneeName: 'An',
      }),
    ]);
    fetchSpy.mockRestore();
  });

  it('warns when a member is overloaded', async () => {
    const service = new AiAgentService();

    const result = await service.analyzeWorkload({
      members: [{ id: 'member-1', name: 'An', activeTaskCount: 8, assignedHours: 42 }],
      tasks: [],
    });

    expect(result.warnings).toContain('An đang quá tải: 8 công việc đang làm và 42.0/40.0 giờ.');
  });
});
