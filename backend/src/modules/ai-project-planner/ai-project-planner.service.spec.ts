import { buildPlannerPrompt } from './planner-prompts';

describe('AiProjectPlannerService planning prompt', () => {
  it('instructs AI to create one named project when the user provides a project name', () => {
    const prompt = buildPlannerPrompt(
      'Tên dự án: Mekong\nMô tả: Làm 2 video sản phẩm quảng cáo.',
      [],
    );

    expect(prompt).toContain('chỉ tạo đúng 1 project với tên đó');
    expect(prompt).toContain('Tên dự án: Mekong');
    expect(prompt).not.toContain('Tạo từ 3 đến 6 project');
  });
});
