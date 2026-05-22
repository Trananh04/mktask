import {
  buildAssistantSystemPrompt,
  buildAssistantUserContext,
  isAutomationEnvelope,
} from './assistant-prompts';

describe('AI assistant guidance prompts', () => {
  it('keeps plain assistant messages out of browser automation mode', () => {
    expect(isAutomationEnvelope('Huong dan toi su dung mktask')).toBe(false);
    expect(
      isAutomationEnvelope(
        'Task: Create task Deploy release\n\nCurrent URL: http://localhost:3001/tasks\n\nAvailable elements:\n[1] button Create Task',
      ),
    ).toBe(true);
  });

  it('teaches the assistant to guide users before acting', () => {
    const prompt = buildAssistantSystemPrompt();

    expect(prompt).toContain('mktask personal work assistant');
    expect(prompt).toContain('how to use mktask');
    expect(prompt).toContain('Do not claim that an action was completed');
  });

  it('adds app workflow guidance to conversational user context', () => {
    const prompt = buildAssistantUserContext('How do I invite a project member?');

    expect(prompt).toContain('User request: How do I invite a project member?');
    expect(prompt).toContain('Invite to Project');
    expect(prompt).toContain('Available mktask guidance');
  });
});
