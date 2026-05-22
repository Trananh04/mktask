const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const apiCalls = [];

  page.on('request', (req) => {
    if (req.url().includes('/ai-project-planner/apply')) {
      apiCalls.push({ url: req.url(), method: req.method(), postData: req.postData() });
    }
  });

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"], input[name="email"]', 'anhtank47@gmail.com');
  await page.fill('input[type="password"], input[name="password"]', 'lmht2341');
  await page.click('button:has-text("Đăng nhập"), button:has-text("Login"), button[type="submit"]');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:3001/settings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const panelVisible = await page.locator('text=Lập kế hoạch dự án bằng AI').first().isVisible().catch(() => false);
  let descOk = false;
  let summaryHasUnassigned = false;

  if (panelVisible) {
    descOk = await page.locator('text=Nhập mô tả, AI sẽ chia dự án và tạo task để bạn duyệt trước khi tạo thật.').first().isVisible().catch(() => false);
    await page.fill('textarea', 'Xây dựng hệ thống CRM cho sales, marketing và CSKH');
    await page.click('button:has-text("Tạo bản nháp")');
    await page.waitForTimeout(7000);
    summaryHasUnassigned = await page.locator('text=chưa gán người phụ trách').first().isVisible().catch(() => false);

    const createBtn = page.locator('button:has-text("Tạo dự án và công việc")').first();
    if (await createBtn.isEnabled().catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const textareas = page.locator('textarea');
  const count = await textareas.count();
  if (count > 0) {
    await textareas.nth(count - 1).fill('Hãy lập kế hoạch dự án app quản lý kho và chia task chi tiết');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(8000);
    const applyBtn = page.locator('button:has-text("Tạo dự án và công việc")').last();
    if (await applyBtn.isVisible().catch(() => false)) {
      await applyBtn.click();
      await page.waitForTimeout(5000);
    }
  }

  const applyPayloads = apiCalls.map((c) => {
    try {
      return JSON.parse(c.postData || '{}');
    } catch {
      return { raw: c.postData };
    }
  });

  console.log(JSON.stringify({ panelVisible, descOk, summaryHasUnassigned, applyCallCount: applyPayloads.length, applyPayloads }, null, 2));

  await browser.close();
})();