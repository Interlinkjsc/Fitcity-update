const User = require('../../users/models/userModel.js');
const Branch = require('../../crm/models/branchModel.js');
const clientManagementService = require('../../clients/services/clientManagementService.js');
const { hash } = require('../../../utils/encryption');
const permissionService = require('../../../core/permissionService');

const ADMIN_LIKE_ROLES = ['Admin', 'Manager', 'SA', 'Sales', 'Marketing', 'Accountant', 'CEO'];

function redirectByRole(res, role) {
    if (ADMIN_LIKE_ROLES.includes(role)) return res.redirect('/admin');
    if (role === 'PT') return res.redirect('/pt');
    return res.redirect('/client');
}

function startUserSession(req, res, user, { onErrorRedirect = '/auth/login' } = {}) {
    req.session.user = permissionService.buildSessionUserPayload(user);

    req.session.save((err) => {
        if (err) {
            console.error('Session save error:', err);
            req.flash('error_msg', 'Không thể tạo phiên đăng nhập. Vui lòng thử đăng nhập lại.');
            return res.redirect(onErrorRedirect);
        }
        redirectByRole(res, user.role);
    });
}

/**
 * Hiển thị trang đăng nhập / đăng ký
 */
exports.showLogin = async (req, res) => {
    try {
        const branches = await Branch.find({ status: 'Open' }).select('name').sort({ name: 1 }).lean();
        const view = req.query.view === 'register' ? 'register' : 'login';
        res.render('login', { branches, view });
    } catch (err) {
        console.error('Show Login Error:', err);
        res.render('login', { branches: [], view: 'login' });
    }
};

/**
 * Đăng ký tài khoản hội viên (Client) — công khai
 */
exports.register = async (req, res) => {
    const redirectRegister = () => res.redirect('/auth/login?view=register');

    try {
        const { name, email, password, confirmPassword, phone, branch } = req.body;

        if (!name?.trim() || !email?.trim() || !password || !branch) {
            req.flash('error_msg', 'Vui lòng điền đầy đủ Họ tên, Email, Mật khẩu và Chi nhánh');
            return redirectRegister();
        }

        if (password.length < 6) {
            req.flash('error_msg', 'Mật khẩu phải có ít nhất 6 ký tự');
            return redirectRegister();
        }

        if (password !== confirmPassword) {
            req.flash('error_msg', 'Mật khẩu xác nhận không khớp');
            return redirectRegister();
        }

        const payload = {
            name: name.trim(),
            email: email.trim(),
            password,
            phone: phone?.trim() || undefined,
            branch,
            status: 'Active',
            role: 'Client'
        };

        const referralCode = req.body.referralCode?.trim();
        if (referralCode) {
            const affiliateService = require('../../programs/services/affiliateService');
            const referrer = await affiliateService.resolveReferrerByCode(referralCode);
            if (referrer) payload.referredBy = referrer._id;
        }

        const user = await clientManagementService.createClient(payload);

        req.flash('success_msg', 'Đăng ký thành công! Chào mừng bạn đến với FitCity.');
        startUserSession(req, res, user, { onErrorRedirect: '/auth/login?view=register' });
        return;
    } catch (err) {
        if (err.name === 'ClientServiceError' && err.code === 'DUPLICATE_EMAIL') {
            req.flash('error_msg', err.message);
            return redirectRegister();
        }
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map((val) => val.message).join(', ');
            req.flash('error_msg', messages);
            return redirectRegister();
        }
        console.error('Register Error:', err);
        req.flash('error_msg', 'Đã có lỗi xảy ra, vui lòng thử lại sau');
        return redirectRegister();
    }
};

/**
 * Handle Login
 * - Validate Email/Password
 * - Set User Session
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            req.flash('error_msg', 'Vui lòng nhập đầy đủ Email và Mật khẩu');
            return res.redirect('/auth/login');
        }

        const user = await User.findOne({ emailHash: hash(email) }).select('+password');
        
        if (!user) {
            req.flash('error_msg', 'Email hoặc Mật khẩu không chính xác');
            return res.redirect('/auth/login');
        }

        // Check if user is locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
            req.flash('error_msg', `Tài khoản đã bị tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${minutesLeft} phút.`);
            return res.redirect('/auth/login');
        }
        
        const isPasswordCorrect = await user.correctPassword(password, user.password);

        if (!isPasswordCorrect) {
            user.loginAttempts += 1;
            if (user.loginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
                req.flash('error_msg', 'Nhập sai 5 lần. Tài khoản đã bị khóa 30 phút.');
            } else {
                req.flash('error_msg', `Email hoặc Mật khẩu không chính xác. Đã sai ${user.loginAttempts}/5 lần.`);
            }
            await user.save({ validateBeforeSave: false }); // Bypass validation like phone regex
            return res.redirect('/auth/login');
        }

        if (user.status !== 'Active') {
            req.flash('error_msg', 'Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động');
            return res.redirect('/auth/login');
        }

        // Reset login attempts on success
        if (user.loginAttempts > 0) {
            user.loginAttempts = 0;
            user.lockUntil = undefined;
            await user.save({ validateBeforeSave: false });
        }

        console.log(`User ${user.email} logged in. Role: ${user.role}. Session ID: ${req.sessionID}`);
        startUserSession(req, res, user);

    } catch (err) {
        console.error('Login Error:', err);
        req.flash('error_msg', 'Đã có lỗi xảy ra, vui lòng thử lại sau');
        return res.redirect('/auth/login');
    }
};

/**
 * Handle Logout
 * - Destroy Session
 */
exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Logout Error:', err);
        res.clearCookie('connect.sid');
        res.redirect('/auth/login');
    });
};

/**
 * Get Profile
 */
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id).populate('branch');
        const viewName = req.session.user.role === 'Client' ? 'client/profile' : 'profile';
        let affiliate = null;
        if (req.session.user.role === 'Client') {
            const affiliateService = require('../../programs/services/affiliateService');
            affiliate = await affiliateService.getReferralDashboard(req.session.user.id);
        }
        res.render(viewName, { user, affiliate });
    } catch (err) {
        res.status(500).render('error', { message: 'Không tìm thấy thông tin cá nhân' });
    }
};
/**
 * Update Profile
 */
exports.updateProfile = async (req, res) => {
    try {
        const { phone, bankName, accountName, accountNumber } = req.body;
        
        const user = await User.findById(req.session.user.id);
        if (!user) {
            req.flash('error_msg', 'Không tìm thấy người dùng');
            return res.redirect('/auth/profile');
        }

        // Cập nhật thông tin cơ bản
        if (phone) user.phone = phone;

        // Cập nhật thông tin ngân hàng an toàn
        user.bankInfo = {
            bankName: bankName || (user.bankInfo ? user.bankInfo.bankName : ''),
            accountName: accountName || (user.bankInfo ? user.bankInfo.accountName : ''),
            accountNumber: accountNumber || (user.bankInfo ? user.bankInfo.accountNumber : '')
        };

        await user.save();

        // Cập nhật lại session nếu cần (tên hoặc avatar)
        req.session.user.name = user.name;
        
        req.flash('success_msg', 'Cập nhật hồ sơ thành công');
        res.redirect('/auth/profile');

    } catch (err) {
        console.error('Update Profile Error:', err);
        req.flash('error_msg', 'Lỗi: ' + err.message);
        res.redirect('/auth/profile');
    }
};
