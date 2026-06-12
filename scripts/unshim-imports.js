/**
 * Rewrite requires that resolve under src/{models,services,controllers} (shims)
 * to direct src/modules/... paths.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const SHIM_MODELS = path.join(SRC, 'models');
const SHIM_SERVICES = path.join(SRC, 'services');
const SHIM_CONTROLLERS = path.join(SRC, 'controllers');

const MODEL_MAP = {
    userModel: 'users',
    roleModel: 'users',
    contractModel: 'contracts',
    pauseRequestModel: 'contracts',
    transactionModel: 'contracts',
    branchModel: 'crm',
    leadModel: 'crm',
    violationModel: 'crm',
    expenseModel: 'finance',
    payrollModel: 'finance',
    couponModel: 'finance',
    mealPlanModel: 'programs',
    workoutProgramModel: 'programs',
    workoutSessionModel: 'programs',
    bodyMetricModel: 'programs',
    kpiModel: 'programs',
    rewardModel: 'programs',
    servicePackageModel: 'programs',
    ptAvailabilitySlotModel: 'pt',
    ptChangeRequestModel: 'pt',
    notificationModel: 'platform'
};

const SERVICE_MAP = {
    contractService: 'contracts',
    contractPauseService: 'contracts',
    contractLiquidationService: 'contracts',
    paymentService: 'contracts',
    pdfService: 'contracts',
    payrollService: 'finance',
    rewardService: 'programs',
    workoutService: 'programs',
    clientManagementService: 'clients',
    notificationService: 'platform',
    socketService: 'platform',
    driveService: 'platform',
    reportService: 'platform',
    scheduleService: 'platform'
};

const CONTROLLER_MAP = {
    authController: 'auth',
    userController: 'users',
    clientController: 'clients',
    clientScheduleController: 'clients',
    clientManagementController: 'clients',
    contractController: 'contracts',
    paymentController: 'contracts',
    ptController: 'pt',
    ptSlotController: 'pt',
    adminSlotController: 'pt',
    ptChangeRequestController: 'pt',
    expenseController: 'finance',
    payrollController: 'finance',
    couponController: 'finance',
    mealPlanController: 'programs',
    rewardController: 'programs',
    metricController: 'programs',
    kpiController: 'programs',
    packageController: 'programs',
    leadController: 'crm',
    branchController: 'crm',
    violationController: 'crm',
    homeController: 'platform',
    calendarController: 'api'
};

function walk(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === '.git') continue;
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) out.push(...walk(p));
        else if (name.endsWith('.js')) out.push(p);
    }
    return out;
}

function isShimFile(absPath) {
    if (!fs.existsSync(absPath) || !absPath.endsWith('.js')) return false;
    const txt = fs.readFileSync(absPath, 'utf8').trim();
    return /^module\.exports\s*=\s*require\s*\(\s*['"]/.test(txt);
}

function relRequire(fromFile, targetAbs) {
    let r = path.relative(path.dirname(fromFile), targetAbs).replace(/\\/g, '/');
    if (!r.startsWith('.')) r = `./${r}`;
    return r;
}

function mapShimToTarget(abs) {
    const base = path.basename(abs, '.js');
    const dir = path.dirname(abs);
    if (dir === SHIM_MODELS && MODEL_MAP[base]) {
        return path.join(SRC, 'modules', MODEL_MAP[base], 'models', `${base}.js`);
    }
    if (dir === SHIM_SERVICES && SERVICE_MAP[base]) {
        return path.join(SRC, 'modules', SERVICE_MAP[base], 'services', `${base}.js`);
    }
    if (dir === SHIM_CONTROLLERS && CONTROLLER_MAP[base]) {
        return path.join(SRC, 'modules', CONTROLLER_MAP[base], 'controllers', `${base}.js`);
    }
    return null;
}

function migrateFile(file) {
    const relFromRoot = path.relative(ROOT, file);
    if (relFromRoot.startsWith(`src${path.sep}models`)) return false;
    if (relFromRoot.startsWith(`src${path.sep}services`)) return false;
    if (relFromRoot.startsWith(`src${path.sep}controllers`)) return false;

    let s = fs.readFileSync(file, 'utf8');
    const orig = s;

    const repl = [];

    function scan(regex, wrapFn) {
        let mm;
        const r = new RegExp(regex.source, regex.flags);
        while ((mm = r.exec(orig)) !== null) {
            const full = mm[0];
            const q = mm[1];
            const reqPath = mm[2];
            if (!reqPath.startsWith('.')) continue;

            const abs = path.resolve(path.dirname(file), reqPath);
            const target = mapShimToTarget(abs);

            if (target && fs.existsSync(target) && !isShimFile(target)) {
                const newReq = relRequire(file, target);
                repl.push({ from: full, to: wrapFn(q, newReq) });
            }
        }
    }

    scan(/require\s*\(\s*(['"])([^'"]+)\1\s*\)/g, (q, newReq) => `require(${q}${newReq}${q})`);
    scan(/jest\.mock\s*\(\s*(['"])([^'"]+)\1\s*\)/g, (q, newReq) => `jest.mock(${q}${newReq}${q})`);

    const seen = new Set();
    repl.sort((a, b) => b.from.length - a.from.length);
    for (const { from, to } of repl) {
        if (seen.has(from)) continue;
        seen.add(from);
        s = s.split(from).join(to);
    }

    if (s !== orig) {
        fs.writeFileSync(file, s, 'utf8');
        return true;
    }
    return false;
}

function main() {
    const files = new Set([
        ...walk(path.join(SRC, 'modules')),
        ...walk(path.join(SRC, 'middlewares')),
        ...walk(path.join(SRC, 'cron')),
        ...walk(path.join(SRC, 'seeds')),
        ...walk(path.join(ROOT, 'tests')),
        ...walk(path.join(ROOT, 'scripts')),
        path.join(SRC, 'server.js'),
        path.join(SRC, 'app.js')
    ]);

    let changed = 0;
    for (const f of files) {
        if (!f || !fs.existsSync(f) || !f.endsWith('.js')) continue;
        if (migrateFile(f)) changed++;
    }
    console.log('files-updated', changed);
}

main();
