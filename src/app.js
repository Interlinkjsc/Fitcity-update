const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { MongoStore } = require('connect-mongo');
const flash = require('connect-flash');
const { errorHandler } = require('./middlewares/errorHandler');
const { mountFeatureRouters, mountDashboardRoutes } = require('./core/httpMount');
const { controllers: { homeController } } = require('./modules/platform');
const { protect, restrictTo } = require('./middlewares/authMiddleware');
const { fetchNotifications } = require('./middlewares/notificationMiddleware');
const { getAllowedMenuItems, getAllowedMenuGroups, getSidebarNavPayload } = require('./utils/sidebarMenu');

const app = express();

if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
}

// 1. Cấu hình View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 2. Middlewares
app.use(morgan('dev'));
app.use(cookieParser());
// CORS: whitelist thay vì mở toàn bộ (bảo mật). Origin ngoài whitelist vẫn gọi được
// GET công khai (/api/web/*) nhưng không kèm credentials chéo domain.
// ENV CORS_EXTRA_ORIGINS (phân tách bằng dấu phẩy) để thêm domain khi lên tên miền thật.
const corsWhitelist = [
    'https://fitcity.fit',
    'https://www.fitcity.fit',
    'https://erp.fitcity.fit',
    'https://fitcity.vn',
    'https://www.fitcity.vn',
    'http://160.25.81.177',
    'http://160.25.81.177:3000',
    'http://160.25.81.177:4000',
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:4321',
    ...(process.env.CORS_EXTRA_ORIGINS ? process.env.CORS_EXTRA_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : [])
];
app.use(cors({
    origin(origin, cb) {
        // Không có Origin (curl, server-to-server, SSR fetch cùng máy) → cho phép
        if (!origin) return cb(null, true);
        if (corsWhitelist.includes(origin) || /\.fitcity\.(fit|vn)$/.test(origin)) return cb(null, true);
        return cb(null, false); // từ chối CORS nhưng không ném lỗi (request thường vẫn chạy)
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
// Ảnh website do CMS upload (volume ngoài container) — web đọc qua PUBLIC_MEDIA_URL
app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads')));

// Cấu hình Session (Dùng MongoStore để lưu trữ lâu dài và bảo mật)
app.use(session({
    secret: process.env.SESSION_SECRET || 'fitcity_fms_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity',
        collectionName: 'sessions'
    }),
    cookie: { 
        httpOnly: true, // Chống XSS
        secure: process.env.COOKIE_SECURE === 'true'
            || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'),
        sameSite: 'lax', // Chống CSRF cơ bản
        maxAge: 24 * 60 * 60 * 1000 // Session sống 1 ngày
    }
}));

app.use(flash());

// Middleware để truyền Flash messages vào tất cả các View
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.user = req.session.user || null; // Share user payload to EJS templates (e.g. Avatar/Name)
    next();
});

// Middleware lấy Thông báo
app.use(fetchNotifications);

// Middleware: tính menu items được phép cho sidebar (dựa trên role)
app.use(async (req, res, next) => {
    const user = req.session.user;
    if (user) {
        res.locals.allowedAdminMenuItems = getAllowedMenuItems(user);
        res.locals.sidebarMenuGroups = getAllowedMenuGroups(user);
        res.locals.sidebarNavPayload = getSidebarNavPayload(user);
        if (['Admin', 'Manager', 'SA'].includes(user.role)) {
            try {
                const WorkoutSession = require('./modules/programs/models/workoutSessionModel');
                const MealPlan = require('./modules/programs/models/mealPlanModel');
                res.locals.pendingSessionsCount = await WorkoutSession.countDocuments({ status: 'Pending_Admin' });
                res.locals.pendingMealPlansCount = await MealPlan.countDocuments({ status: 'pending_admin' });
            } catch (e) {
                res.locals.pendingSessionsCount = 0;
                res.locals.pendingMealPlansCount = 0;
            }
        }
    } else {
        res.locals.allowedAdminMenuItems = [];
        res.locals.sidebarMenuGroups = [];
    }
    next();
});

// Health (Docker / uptime monitors)
app.get('/health', (req, res) => {
    const mongoose = require('mongoose');
    const dbUp = mongoose.connection.readyState === 1;
    const body = {
        status: dbUp ? 'ok' : 'degraded',
        db: dbUp ? 'up' : 'down',
        uptime: Math.floor(process.uptime())
    };
    res.status(dbUp ? 200 : 503).json(body);
});

// 3. Routes (đăng ký tập trung — xem src/core/httpMount.js)
mountFeatureRouters(app);

// FMS Protected Routes (with RBAC)
mountDashboardRoutes(app, { homeController, protect, restrictTo });

// Error Handler
app.use(errorHandler);

module.exports = app;
