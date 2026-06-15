import { classifyChatIntent } from './ai-data-tools.service';

describe('AI chat intent classification', () => {
  it.each([
    'Tôi đang có bao nhiêu công việc quá hạn?',
    'Tiến độ của dự án X hiện tại là bao nhiêu %?',
    'Ai đang rảnh để tôi giao thêm việc khẩn cấp?',
    'Tại sao task tích hợp Momo bị pending lâu?',
    'Hôm nay nhân viên C có nộp daily report không?',
    'Có bao nhiêu người đang tham gia dự án Z và ai là Manager?',
    'Hôm qua team Frontend đã làm xong những gì?',
    'Dự án này xong chưa?',
    'Nhân viên A làm ở đây bao lâu rồi?',
  ])('routes data question to QUERY_DATA: %s', (message) => {
    expect(classifyChatIntent(message)).toBe('QUERY_DATA');
  });

  it('only uses automation mode when envelope is provided', () => {
    expect(classifyChatIntent('Tạo task sửa trang đăng nhập')).toBe('QUERY_DATA');
    expect(classifyChatIntent('anything', true)).toBe('AUTOMATION');
  });

  it('keeps usage questions in QUERY_DATA for planner to decide', () => {
    expect(classifyChatIntent('Hướng dẫn tôi mời thành viên')).toBe('QUERY_DATA');
  });
});
