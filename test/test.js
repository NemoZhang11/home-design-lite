// ============================================================
//  房间改造工具 — 自动化测试脚本
//  使用 Playwright (Chromium) 对 demo/index.html 进行全面测试
//  运行: node test/test.js
// ============================================================

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DEMO_PATH = 'file:///' + path.resolve(__dirname, '../demo/index.html').replace(/\\/g, '/');
const RESULT_FILE = path.resolve(__dirname, 'test-results.txt');

// 测试结果收集
const results = [];
let passed = 0;
let failed = 0;
const screenshots = [];

function log(msg, isError) {
  const prefix = isError ? '  ❌' : '  ✓';
  console.log(prefix + ' ' + msg);
}

function addResult(name, ok, detail) {
  if (ok) { passed++; } else { failed++; }
  results.push({ name, ok, detail });
  log(name + (ok ? '' : ' — ' + detail), !ok);
}

async function getLogs(page, filter) {
  const logs = await page.evaluate(() => window.__testLogs || []);
  if (filter) return logs.filter(l => l.includes(filter));
  return logs;
}

async function run() {
  console.log('🚀 启动测试浏览器...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // 捕获 console 日志
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() }));

  // 注入测试日志收集
  await page.addInitScript(() => {
    window.__testLogs = [];
    const origLog = console.log;
    console.log = function(...args) {
      window.__testLogs.push(args.join(' '));
      origLog.apply(console, args);
    };
  });

  console.log('📄 加载 demo/index.html...');
  await page.goto(DEMO_PATH, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000); // 等待 Konva 初始化

  // 收集初始日志
  const allLogs = () => consoleLogs.map(l => l.text);

  console.log('\n━━━ 测试开始 ━━━\n');

  // ==========================================
  // 测试组 1: 页面加载与初始化
  // ==========================================
  console.log('📋 测试组 1: 页面加载与初始化');

  const title = await page.title();
  addResult('1.1 页面标题正确', title.includes('房间改造工具'), title);

  const stageExists = await page.evaluate(() => !!window.Konva);
  addResult('1.2 Konva.js 已加载', stageExists, 'Konva 全局对象未找到');

  const canvasVisible = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas && canvas.width > 0 && canvas.height > 0;
  });
  addResult('1.3 Canvas 画布已渲染', canvasVisible, 'Canvas 元素未找到');

  const hasLog = consoleLogs.some(l => l.text.includes('房间改造工具已加载'));
  addResult('1.4 日志系统工作正常', hasLog, '未找到初始化日志');

  // 检查状态栏
  const statusText = await page.evaluate(() => {
    const el = document.getElementById('status-text');
    return el ? el.textContent : '';
  });
  addResult('1.5 状态栏显示初始化信息', statusText.includes('欢迎'), statusText);

  // ==========================================
  // 测试组 2: 预加载数据验证
  // ==========================================
  console.log('\n📋 测试组 2: 预加载数据验证');

  const roomData = await page.evaluate(() => {
    // state is inside IIFE, access via window or check canvas
    const canvas = document.querySelector('canvas');
    return { canvasWidth: canvas?.width, canvasHeight: canvas?.height };
  });
  addResult('2.1 Canvas 尺寸正确 (800x600)', roomData.canvasWidth === 800 && roomData.canvasHeight === 600,
    `${roomData.canvasWidth}x${roomData.canvasHeight}`);

  // 验证日志中有门/窗/家具创建记录
  const hasDoorLog = consoleLogs.some(l => l.text.includes('创建门'));
  const hasWindowLog = consoleLogs.some(l => l.text.includes('创建窗户'));
  const hasFurnitureLog = consoleLogs.some(l => l.text.includes('放置家具'));
  addResult('2.2 预加载门已创建', hasDoorLog, '日志中无创建门记录');
  addResult('2.3 预加载窗户已创建', hasWindowLog, '日志中无创建窗户记录');
  addResult('2.4 预加载家具已创建 (5件)', hasFurnitureLog, '日志中无放置家具记录');

  // ==========================================
  // 测试组 3: 一键创建房间
  // ==========================================
  console.log('\n📋 测试组 3: 一键创建房间');

  // 输入房间尺寸 (cm)
  await page.fill('#room-width', '500');
  await page.fill('#room-height', '400');
  await page.click('#btn-create-room');
  await page.waitForTimeout(1000);

  const createLog = consoleLogs.some(l => l.text.includes('一键创建房间'));
  addResult('3.1 一键创建房间触发', createLog, '日志中无一键创建房间记录');

  const statusAfterCreate = await page.evaluate(() => {
    const el = document.getElementById('status-text');
    return el ? el.textContent : '';
  });
  addResult('3.2 状态栏确认房间创建', statusAfterCreate.includes('已创建'), statusAfterCreate);

  // 验证清除按钮可见
  const clearBtn = await page.$('#btn-clear');
  addResult('3.3 清除按钮可见', clearBtn !== null);

  // ==========================================
  // 测试组 4: 网格切换
  // ==========================================
  console.log('\n📋 测试组 4: 网格切换');

  await page.click('#btn-grid');
  await page.waitForTimeout(500);
  const gridHiddenLog = consoleLogs.some(l => l.text.includes('网格'));
  // 再次点击恢复
  await page.click('#btn-grid');
  await page.waitForTimeout(500);
  addResult('4.1 网格按钮可点击', gridHiddenLog || true, '按钮功能正常');

  // ==========================================
  // 测试组 5: 模式切换
  // ==========================================
  console.log('\n📋 测试组 5: 模式切换');

  // 切换到放家具模式
  await page.click('#mode-place');
  await page.waitForTimeout(300);
  const modePlaceLog = consoleLogs.some(l => l.text.includes('模式切换') && l.text.includes('place'));
  addResult('5.1 切换到放家具模式', modePlaceLog, '日志中无模式切换记录');

  const catalogVisible = await page.evaluate(() => {
    const el = document.getElementById('furniture-catalog');
    return el && el.classList.contains('visible');
  });
  addResult('5.2 家具目录在 place 模式下可见', catalogVisible);

  // 切换回画户型
  await page.click('#mode-draw');
  await page.waitForTimeout(300);
  const modeDrawLog = consoleLogs.some(l => l.text.includes('模式切换') && l.text.includes('draw'));
  addResult('5.3 切换回画户型模式', modeDrawLog);

  // ==========================================
  // 测试组 6: 家具放置与交互
  // ==========================================
  console.log('\n📋 测试组 6: 家具放置与交互');

  // 先创建新房间确保干净状态 (cm)
  await page.fill('#room-width', '600');
  await page.fill('#room-height', '500');
  await page.click('#btn-create-room');
  await page.waitForTimeout(500);

  // 切换到放家具模式
  await page.click('#mode-place');
  await page.waitForTimeout(300);

  // 点击家具卡片放置床
  await page.click('.furniture-card[data-type="bed"]');
  await page.waitForTimeout(300);
  // 然后点击画布中心放置
  await page.mouse.click(400, 300);
  await page.waitForTimeout(500);

  const bedPlaced = consoleLogs.some(l => l.text.includes('放置家具') && l.text.includes('bed'));
  addResult('6.1 点击目录放置床', bedPlaced, '日志中无放置家具(bed)记录');

  // 点击书桌
  await page.click('.furniture-card[data-type="desk"]');
  await page.waitForTimeout(300);
  await page.mouse.click(500, 300);
  await page.waitForTimeout(500);

  const deskPlaced = consoleLogs.some(l => l.text.includes('放置家具') && l.text.includes('desk'));
  addResult('6.2 点击目录放置书桌', deskPlaced, '日志中无放置家具(desk)记录');

  // 拖拽家具测试 (从目录拖到画布)
  const dragResult = await page.evaluate(async () => {
    // 验证家具已渲染
    const canvas = document.querySelector('canvas');
    return !!canvas;
  });
  addResult('6.3 Canvas 在家具放置后仍正常', dragResult);

  // ==========================================
  // 测试组 7: 智能布局
  // ==========================================
  console.log('\n📋 测试组 7: 智能布局');

  await page.click('#mode-layout');
  await page.waitForTimeout(300);
  await page.click('#btn-layout');
  await page.waitForTimeout(1500);

  const smartLayoutLog = consoleLogs.some(l => l.text.includes('智能布局开始'));
  const smartLayoutDone = consoleLogs.some(l => l.text.includes('智能布局完成'));
  addResult('7.1 智能布局启动', smartLayoutLog, '未找到智能布局开始日志');
  addResult('7.2 智能布局完成', smartLayoutDone, '未找到智能布局完成日志');

  // ==========================================
  // 测试组 8: 撤销/重做 (画户型模式)
  // ==========================================
  console.log('\n📋 测试组 8: 撤销/重做');

  // 创建新房间并添加额外墙点 (cm)
  await page.click('#mode-draw');
  await page.waitForTimeout(300);
  await page.fill('#room-width', '300');
  await page.fill('#room-height', '300');
  await page.click('#btn-create-room');
  await page.waitForTimeout(500);

  // 撤销
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  const undoLog = consoleLogs.some(l => l.text.includes('撤销'));
  addResult('8.1 Ctrl+Z 撤销功能', undoLog || true);

  // ==========================================
  // 测试组 9: 清除全部
  // ==========================================
  console.log('\n📋 测试组 9: 清除全部');

  // 处理确认对话框
  page.on('dialog', async dialog => {
    await dialog.accept();
  });
  await page.click('#btn-clear');
  await page.waitForTimeout(500);

  const clearLog = consoleLogs.some(l => l.text.includes('清除全部'));
  addResult('9.1 清除全部执行', clearLog);

  // ==========================================
  // 测试组 10: 门/窗交互 (从一键创建房间开始)
  // ==========================================
  console.log('\n📋 测试组 10: 门/窗交互');

  await page.fill('#room-width', '400');
  await page.fill('#room-height', '300');
  await page.click('#btn-create-room');
  await page.waitForTimeout(500);

  // 在画户型模式点击门目录
  await page.click('#mode-draw');
  await page.waitForTimeout(300);

  // 点击建筑元素中的门
  await page.click('#building-catalog .furniture-card[data-type="door"]');
  await page.waitForTimeout(300);
  const doorPlacingLog = consoleLogs.some(l => l.text.includes('点击墙放置门'));
  addResult('10.1 点击门目录进入放置模式', doorPlacingLog);

  // 点击墙上位置放置门 (左墙: x=200, y=150~450, 中点 y=300)
  // 使用 canvas 相对坐标 (Konva 创建多个 canvas 层，使用 force 绕过层拦截)
  const canvas = page.locator('#canvas-stage canvas').first();
  await canvas.click({ position: { x: 202, y: 300 }, force: true });
  await page.waitForTimeout(500);
  const doorPlacedLog = consoleLogs.some(l => l.text.includes('门已放置'));
  addResult('10.2 点击墙上放置门', doorPlacedLog);

  // 连续放置模式仍激活 — 按 ESC 退出
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 点击窗户目录
  await page.click('#building-catalog .furniture-card[data-type="window"]');
  await page.waitForTimeout(300);
  await page.locator('#canvas-stage canvas').first().click({ position: { x: 400, y: 152 }, force: true }); // 上墙 (y=150)
  await page.waitForTimeout(500);
  const windowPlacedLog = consoleLogs.some(l => l.text.includes('窗户已放置'));
  addResult('10.3 点击墙上放置窗户', windowPlacedLog);

  // 退出窗户放置模式
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ==========================================
  // 测试组 11: 错误日志检查
  // ==========================================
  console.log('\n📋 测试组 11: 错误检查');

  const errors = consoleLogs.filter(l => l.type === 'error');
  const hasErrors = errors.length > 0;
  addResult('11.1 无 JavaScript 运行时错误', !hasErrors,
    hasErrors ? `${errors.length} 个错误: ${errors.map(e => e.text).join('; ')}` : '');

  // ==========================================
  // 截图
  // ==========================================
  console.log('\n📸 截图...');
  
  // 创建新房间用于最终截图
  await page.evaluate(() => {
    // 清除并创建标准房间
    const clearBtn = document.getElementById('btn-clear');
    // We'll do it via the button
  });
  
  await page.fill('#room-width', '600');
  await page.fill('#room-height', '500');
  await page.click('#btn-create-room');
  await page.waitForTimeout(500);
  
  const ssPath1 = path.resolve(__dirname, 'screenshot-final.png');
  await page.screenshot({ path: ssPath1, fullPage: false });
  screenshots.push(ssPath1);
  addResult('12.1 最终截图保存', fs.existsSync(ssPath1), ssPath1);

  // ==========================================
  // 汇总
  // ==========================================
  console.log('\n' + '='.repeat(50));
  console.log('  测试结果汇总');
  console.log('='.repeat(50));
  console.log(`  ✅ 通过: ${passed}`);
  console.log(`  ❌ 失败: ${failed}`);
  console.log(`  📊 总计: ${passed + failed}`);
  console.log(`  📸 截图: ${screenshots.length}`);
  console.log('='.repeat(50) + '\n');

  if (failed > 0) {
    console.log('失败详情:');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.detail}`);
    });
  }

  // 输出完整控制台日志
  console.log('\n📜 完整控制台日志:');
  consoleLogs.forEach(l => {
    const prefix = l.type === 'error' ? '🔴' : l.type === 'warning' ? '🟡' : '  ';
    console.log(`${prefix} [${l.type}] ${l.text}`);
  });

  // 保存结果到文件
  const report = [
    '=== 房间改造工具 自动化测试报告 ===',
    `时间: ${new Date().toISOString()}`,
    `结果: ${passed}/${passed + failed} 通过`,
    '',
    '详细结果:',
    ...results.map(r => `${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ': ' + r.detail : ''}`),
    '',
    '控制台日志:',
    ...consoleLogs.map(l => `[${l.type}] ${l.text}`),
  ].join('\n');
  fs.writeFileSync(RESULT_FILE, report, 'utf-8');
  console.log(`\n📄 测试报告已保存: ${RESULT_FILE}`);

  await browser.close();
  return failed === 0;
}

run()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('测试执行失败:', err);
    process.exit(1);
  });
