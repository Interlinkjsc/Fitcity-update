/**
 * Batch UI capture — Client & PT, desktop + mobile (E2E seed data).
 * Usage: npm run seed:e2e:faker && node scripts/capture-ui-screenshots.js
 */
require('dotenv').config();
const { chromium, devices } = require('@playwright/test');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const OUT = path.resolve('docs/screenshots/ui-capture');

const CLIENT_EMAIL = process.env.CAPTURE_CLIENT_EMAIL || 'e2e.client@fitcity.com';
const PT_EMAIL = process.env.CAPTURE_PT_EMAIL || 'e2e.pt@fitcity.com';
const ADMIN_EMAIL = process.env.CAPTURE_ADMIN_EMAIL || 'admin@fitcity.com';
const PASSWORD = '123456';

const ARGS = process.argv.slice(2);
const ONLY_ADMIN = ARGS.includes('--admin-only');
const SKIP_ADMIN = ARGS.includes('--skip-admin');
const ONLY_MOBILE = ARGS.includes('--mobile-only');
const ONLY_DESKTOP = ARGS.includes('--desktop-only');
const ADMIN_EXTRA_ONLY = ARGS.includes('--admin-extra-only');

const CLIENT_PAGES = [
  ['01-dashboard', '/client'],
  ['02-nutrition', '/client/nutrition'],
  ['03-schedule', '/client/schedule'],
  ['04-workouts', '/client/workouts'],
  ['05-progress', '/client/progress?days=30'],
  ['06-rewards', '/client/rewards'],
  ['07-contracts', '/client/contracts'],
  ['08-profile', '/auth/profile'],
];

const PT_PAGES = [
  ['01-dashboard', '/pt'],
  ['02-clients', '/pt/clients'],
  ['03-schedule', '/pt/schedule'],
  ['04-income', '/pt/income'],
  ['05-attendance', '/pt/attendance'],
  ['06-daily-report', '/pt/daily-report'],
  ['07-leave', '/pt/leave'],
  ['08-slots', '/pt/slots'],
  ['09-requests', '/pt/requests'],
  ['10-meal-plans', '/pt/meal-plans'],
  ['11-meal-plans-create', '/pt/meal-plans/create'],
  ['12-workout-assignments', '/pt/workout-assignments'],
  ['13-metrics', '/pt/metrics'],
  ['14-contracts-create', '/pt/contracts/create'],
];

/** Admin / SA — sidebar modules */
const ADMIN_PAGES = [
  ['01-dashboard', '/admin'],
  ['02-leads', '/admin/leads'],
  ['03-contracts', '/admin/contracts/list'],
  ['04-contracts-create', '/admin/contracts/create'],
  ['05-contracts-pause-requests', '/admin/contracts/requests'],
  ['06-clients', '/admin/clients/list'],
  ['07-users', '/admin/users/list'],
  ['08-packages', '/admin/packages/list'],
  ['09-payroll', '/admin/payroll'],
  ['10-expenses', '/admin/expenses'],
  ['11-coupons', '/admin/coupons'],
  ['12-rewards', '/admin/rewards'],
  ['13-cms', '/admin/cms'],
  ['14-cms-create', '/admin/cms/create'],
  ['15-content-library', '/admin/content-library'],
  ['16-branches', '/admin/branches/list'],
  ['17-violations', '/admin/violations'],
  ['18-settings', '/admin/settings'],
  ['19-checklists', '/admin/checklists'],
  ['20-daily-reports', '/admin/daily-reports'],
  // SA thường không có daily_report.submit — bỏ qua submit form
  ['22-job-descriptions', '/admin/job-descriptions'],
  ['23-permissions', '/admin/permissions'],
  ['24-kpi', '/admin/kpi'],
  ['25-timesheets', '/admin/timesheets'],
  ['26-pt-leave', '/admin/pt-leave-requests'],
  ['27-pt-change-requests', '/admin/pt-change-requests'],
  ['28-slots', '/admin/slots'],
  ['29-slots-requests', '/admin/slots/requests'],
];

async function loadDynamicRoutes() {
  const User = require('../src/modules/users/models/userModel.js');
  const MealPlan = require('../src/modules/programs/models/mealPlanModel.js');
  const WorkoutSession = require('../src/modules/programs/models/workoutSessionModel.js');
  const { hash } = require('../src/utils/encryption');

  const client = await User.findOne({ emailHash: hash(CLIENT_EMAIL) });
  const pt = await User.findOne({ emailHash: hash(PT_EMAIL) });
  const extra = { client: [], pt: [] };

  if (client) {
    const session = await WorkoutSession.findOne({
      client: client._id,
      status: { $in: ['Scheduled', 'In_Progress', 'Completed'] },
    })
      .sort({ startTime: -1 })
      .select('_id');
    if (session) {
      extra.client.push(['09-session-qr', `/client/sessions/${session._id}/qr?action=start`]);
    }
  }

  if (pt) {
    const mealPlan = await MealPlan.findOne({ pt: pt._id, active: true })
      .sort({ updatedAt: -1 })
      .select('_id');
    if (mealPlan) {
      extra.pt.push(['15-meal-plan-detail', `/pt/meal-plans/${mealPlan._id}`]);
    }
    const clientForMetric = await User.findOne({ emailHash: hash(CLIENT_EMAIL) });
    if (clientForMetric) {
      extra.pt.push(['16-metrics-add', `/pt/metrics/add/${clientForMetric._id}`]);
      extra.pt.push(['17-metrics-history', `/pt/metrics/history/${clientForMetric._id}`]);
    }
  }

  return extra;
}

async function loadAdminDynamicRoutes() {
  const Lead = require('../src/modules/crm/models/leadModel.js');
  const Contract = require('../src/modules/contracts/models/contractModel.js');
  const User = require('../src/modules/users/models/userModel.js');
  const ServicePackage = require('../src/modules/programs/models/servicePackageModel.js');
  const Expense = require('../src/modules/finance/models/expenseModel.js');
  const Branch = require('../src/modules/crm/models/branchModel.js');
  const SiteContent = require('../src/modules/crm/models/siteContentModel.js');
  const { hash } = require('../src/utils/encryption');

  const extra = [];

  const lead = await Lead.findOne().sort({ createdAt: -1 }).select('_id');
  if (lead) extra.push(['30-lead-detail', `/admin/leads/detail/${lead._id}`]);

  const contract = await Contract.findOne().sort({ createdAt: -1 }).select('_id');
  if (contract) extra.push(['31-contract-detail', `/admin/contracts/detail/${contract._id}`]);

  const client = await User.findOne({ role: 'Client', status: 'Active' })
    .sort({ createdAt: -1 })
    .select('_id');
  if (client) extra.push(['32-client-detail', `/admin/clients/detail/${client._id}`]);

  const staff =
    (await User.findOne({ emailHash: hash(PT_EMAIL) }).select('_id')) ||
    (await User.findOne({
      role: { $in: ['PT', 'Manager', 'Sales'] },
      status: 'Active',
    })
      .sort({ createdAt: -1 })
      .select('_id'));
  if (staff) extra.push(['33-user-detail', `/admin/users/detail/${staff._id}`]);

  const pkg = await ServicePackage.findOne({ status: 'Active' }).sort({ createdAt: -1 }).select('_id');
  if (pkg) extra.push(['34-package-detail', `/admin/packages/detail/${pkg._id}`]);

  const expense = await Expense.findOne().sort({ createdAt: -1 }).select('_id');
  if (expense) extra.push(['35-expense-detail', `/admin/expenses/detail/${expense._id}`]);

  const branch = await Branch.findOne().sort({ createdAt: -1 }).select('_id');
  if (branch) extra.push(['36-branch-detail', `/admin/branches/detail/${branch._id}`]);

  const cms = await SiteContent.findOne().sort({ updatedAt: -1 }).select('_id');
  if (cms) extra.push(['37-cms-edit', `/admin/cms/edit/${cms._id}`]);

  return extra;
}

async function setupPage(page) {
  await page.route('**/socket.io/**', (route) => route.abort());
}

async function login(page, email) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(client|pt|admin)/, { timeout: 25000 });
}

async function capturePages(page, dir, pages, role, viewport) {
  for (const [name, route] of pages) {
    try {
      const res = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const status = res?.status() ?? 0;
      if (status >= 400) {
        console.warn(`  WARN ${role}/${viewport}/${name} status=${status} ${route}`);
      }
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true, timeout: 60000 });
      console.log(`  OK ${role}/${viewport}/${name}.png`);
    } catch (err) {
      console.warn(`  FAIL ${role}/${viewport}/${name}: ${err.message}`);
    }
  }
}

function viewportsToRun() {
  if (ONLY_MOBILE) return ['mobile'];
  if (ONLY_DESKTOP) return ['desktop'];
  return ['desktop', 'mobile'];
}

async function captureSet(browser, role, email, pages) {
  for (const viewport of viewportsToRun()) {
    const context =
      viewport === 'mobile'
        ? await browser.newContext({ ...devices['iPhone 13'] })
        : await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await setupPage(page);
    await login(page, email);
    const dir = path.join(OUT, role, viewport);
    fs.mkdirSync(dir, { recursive: true });
    await capturePages(page, dir, pages, role, viewport);
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
  const extra = await loadDynamicRoutes();
  const adminExtra = await loadAdminDynamicRoutes();
  const clientPages = [...CLIENT_PAGES, ...extra.client];
  const ptPages = [...PT_PAGES, ...extra.pt];
  const adminPages = [...ADMIN_PAGES, ...adminExtra];

  const browser = await chromium.launch();

  if (!ONLY_ADMIN && !ADMIN_EXTRA_ONLY) {
    console.log(`Client (${CLIENT_EMAIL}) — ${clientPages.length} routes...`);
    await captureSet(browser, 'client', CLIENT_EMAIL, clientPages);
    console.log(`PT (${PT_EMAIL}) — ${ptPages.length} routes...`);
    await captureSet(browser, 'pt', PT_EMAIL, ptPages);
  }

  if (ADMIN_EXTRA_ONLY) {
    const extraOnly = await loadAdminDynamicRoutes();
    const pages = extraOnly.filter(([name]) => name === '30-lead-detail' || name === '37-cms-edit');
    if (pages.length === 0) {
      console.warn('No lead/CMS in DB. Run: node scripts/seed-ui-capture-extras.js');
    } else {
      console.log(`Admin extras (${ADMIN_EMAIL}) — ${pages.length} routes...`);
      await captureSet(browser, 'admin', ADMIN_EMAIL, pages);
    }
  } else if (!SKIP_ADMIN || ONLY_ADMIN) {
    console.log(`Admin (${ADMIN_EMAIL}) — ${adminPages.length} routes...`);
    await captureSet(browser, 'admin', ADMIN_EMAIL, adminPages);
  }

  await browser.close();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  console.log('Done:', OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
