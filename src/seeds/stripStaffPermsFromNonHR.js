/**
 * Bug 23/7 A6+MK1: thu hồi quyền quản lý NHÂN SỰ (staff_management.*) khỏi mọi
 * role/user KHÔNG phải Admin/Manager/SA — sale/mkt trước đây bị backfill nhầm nên
 * vẫn tạo được nhân sự dù menu đã ẩn. syncNewPermissionsToRoles chỉ THÊM, không gỡ,
 * nên phải dọn thủ công 1 lần. Idempotent — chạy lại an toàn.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const RolePermission = require('../modules/platform/models/rolePermissionModel');
const User = require('../modules/users/models/userModel');

const STAFF_PERMS = ['staff_management.view', 'staff_management.create', 'staff_management.update', 'staff_management.manage', 'staff_management.delete'];
const KEEP_ROLES = ['Admin', 'Manager', 'SA'];

async function run() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity';
    await mongoose.connect(uri);
    console.log('[stripStaffPerms] connected');

    // 1. Role permissions (isCustom docs)
    const roleDocs = await RolePermission.find({ role: { $nin: KEEP_ROLES } });
    let roleFixed = 0;
    for (const doc of roleDocs) {
        const before = doc.permissionIds.length;
        doc.permissionIds = doc.permissionIds.filter(p => !STAFF_PERMS.includes(p));
        if (doc.permissionIds.length !== before) {
            await doc.save();
            roleFixed++;
            console.log(`[stripStaffPerms] role "${doc.role}": gỡ ${before - doc.permissionIds.length} quyền nhân sự`);
        }
    }

    // 2. Users với customPermissionIds
    const users = await User.find({
        role: { $nin: KEEP_ROLES },
        customPermissionIds: { $in: STAFF_PERMS }
    });
    let userFixed = 0;
    for (const u of users) {
        u.customPermissionIds = (u.customPermissionIds || []).filter(p => !STAFF_PERMS.includes(p));
        await u.save();
        userFixed++;
    }
    console.log(`[stripStaffPerms] roles dọn: ${roleFixed} | users dọn: ${userFixed}`);

    await mongoose.disconnect();
    console.log('[stripStaffPerms] DONE');
}
run().catch(e => { console.error('[stripStaffPerms] FAIL:', e); process.exit(1); });
