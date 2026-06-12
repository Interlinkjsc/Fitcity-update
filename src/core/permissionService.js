const RolePermission = require('../modules/platform/models/rolePermissionModel');
const registry = require('./permissionsRegistry');

let cache = {
    matrix: null,
    roleSets: null,
    loadedAt: 0
};

const CACHE_TTL_MS = 30_000;

function buildRoleSetsFromMatrix(matrix) {
    const roleSets = {};
    for (const role of registry.ASSIGNABLE_ROLES) {
        roleSets[role] = new Set();
    }
    for (const [resource, actions] of Object.entries(matrix)) {
        for (const [action, roles] of Object.entries(actions)) {
            if (!Array.isArray(roles)) continue;
            const pid = registry.permissionId(resource, action);
            for (const role of roles) {
                if (!roleSets[role]) roleSets[role] = new Set();
                roleSets[role].add(pid);
            }
        }
    }
    return roleSets;
}

async function loadRolePermissionMap() {
    const defaults = registry.buildDefaultRolePermissionMap();
    const docs = await RolePermission.find().lean();
    const map = { ...defaults };
    for (const doc of docs) {
        if (doc.isCustom && Array.isArray(doc.permissionIds)) {
            map[doc.role] = doc.permissionIds.filter((id) => registry.PERMISSION_BY_ID[id]);
        }
    }
    return map;
}

async function refreshCache() {
    const map = await loadRolePermissionMap();
    cache.matrix = registry.buildMatrixFromRolePermissions(map);
    cache.roleSets = buildRoleSetsFromMatrix(cache.matrix);
    cache.loadedAt = Date.now();
    return cache;
}

async function ensureCache() {
    if (!cache.matrix || Date.now() - cache.loadedAt > CACHE_TTL_MS) {
        await refreshCache();
    }
    return cache;
}

async function roleHasPermission(role, resource, action) {
    if (!role) return false;
    if (role === 'SA') return true;
    const { matrix } = await ensureCache();
    const perm = matrix[resource];
    if (!perm) return false;
    if (Array.isArray(perm)) {
        return perm.includes(role);
    }
    return Boolean(perm[action] && perm[action].includes(role));
}

function roleHasPermissionSync(role, resource, action) {
    if (!role) return false;
    if (role === 'SA') return true;
    if (!cache.matrix) return false;
    const perm = cache.matrix[resource];
    if (!perm) return false;
    if (Array.isArray(perm)) {
        return perm.includes(role);
    }
    return Boolean(perm[action] && perm[action].includes(role));
}

async function getRolePermissionIds(role) {
    if (role === 'SA') {
        return registry.PERMISSIONS.map((p) => p.id);
    }
    await ensureCache();
    const set = cache.roleSets[role];
    return set ? [...set] : registry.getSuggestedPermissionIds(role);
}

async function saveRolePermissions(role, permissionIds, updatedBy) {
    if (role === 'SA') {
        throw new Error('Không thể thay đổi quyền của Super Admin.');
    }
    const valid = permissionIds.filter((id) => registry.PERMISSION_BY_ID[id]);
    await RolePermission.findOneAndUpdate(
        { role },
        { permissionIds: valid, isCustom: true, updatedBy },
        { upsert: true, new: true }
    );
    await refreshCache();
    return valid;
}

async function resetRoleToSuggested(role, updatedBy) {
    await RolePermission.deleteOne({ role });
    await refreshCache();
    return registry.getSuggestedPermissionIds(role);
}

function getSuggestedForRole(role) {
    return registry.getSuggestedPermissionIds(role);
}

/**
 * Chi tiết quyền của một role (cho form tạo user / API).
 */
async function getRolePermissionSummary(role) {
    if (!role) return null;
    await ensureCache();

    if (role === 'SA') {
        const grouped = registry.getPermissionsGrouped();
        return {
            role: 'SA',
            roleLabel: registry.ROLE_LABELS.SA || 'Super Admin',
            count: registry.PERMISSIONS.length,
            isCustom: false,
            source: 'full',
            grouped
        };
    }

    if (!registry.ASSIGNABLE_ROLES.includes(role) && role !== 'Client') {
        return null;
    }

    const ids = role === 'Client'
        ? registry.getSuggestedPermissionIds('Client')
        : [...(cache.roleSets[role] || new Set(registry.getSuggestedPermissionIds(role)))];

    const doc = await RolePermission.findOne({ role, isCustom: true }).lean();
    const grouped = {};
    for (const id of ids) {
        const p = registry.PERMISSION_BY_ID[id];
        if (!p) continue;
        if (!grouped[p.group]) grouped[p.group] = [];
        grouped[p.group].push({ id: p.id, label: p.label });
    }

    return {
        role,
        roleLabel: registry.ROLE_LABELS[role] || role,
        count: ids.length,
        isCustom: Boolean(doc),
        source: doc ? 'custom' : 'suggested',
        grouped
    };
}

/** Vai trò mà actor được phép gán khi tạo/sửa user */
function getAssignableRolesForActor(actorRole) {
    const all = ['PT', 'Sales', 'Accountant', 'Marketing', 'Manager', 'CEO', 'Admin', 'SA'];
    if (actorRole === 'SA') return all;
    if (actorRole === 'Admin') return all.filter((r) => r !== 'SA');
    if (actorRole === 'Manager') return ['PT', 'Sales', 'Accountant', 'Marketing', 'Manager'];
    return [];
}

function assertCanAssignRole(actorRole, targetRole) {
    if (!getAssignableRolesForActor(actorRole).includes(targetRole)) {
        throw new Error(`Bạn không có quyền gán vai trò "${targetRole}".`);
    }
    return true;
}

function filterValidPermissionIds(ids = []) {
    return ids.filter((id) => registry.PERMISSION_BY_ID[id]);
}

/**
 * Quyền hiệu lực: role (cache) hoặc bộ custom trên user.
 */
async function getEffectivePermissionIds(userLike) {
    if (!userLike?.role) return [];
    if (userLike.role === 'SA') {
        return registry.PERMISSIONS.map((p) => p.id);
    }
    if (userLike.useCustomPermissions && Array.isArray(userLike.customPermissionIds) && userLike.customPermissionIds.length > 0) {
        return filterValidPermissionIds(userLike.customPermissionIds);
    }
    return getRolePermissionIds(userLike.role);
}

async function getEffectivePermissionSet(userLike) {
    const ids = await getEffectivePermissionIds(userLike);
    return new Set(ids);
}

function userHasPermissionSync(user, resource, action) {
    if (!user?.role) return false;
    if (user.role === 'SA') return true;

    const pid = registry.permissionId(resource, action);
    if (user.useCustomPermissions && Array.isArray(user.customPermissionIds)) {
        return user.customPermissionIds.includes(pid);
    }
    return roleHasPermissionSync(user.role, resource, action);
}

async function userHasPermission(user, resource, action) {
    if (!user?.role) return false;
    if (user.role === 'SA') return true;
    await ensureCache();
    return userHasPermissionSync(user, resource, action);
}

function buildSessionUserPayload(dbUser) {
    return {
        id: dbUser._id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        branch: dbUser.branch,
        avatar: dbUser.avatar,
        useCustomPermissions: Boolean(dbUser.useCustomPermissions),
        customPermissionIds: filterValidPermissionIds(dbUser.customPermissionIds || [])
    };
}

function parsePermissionFieldsFromBody(body) {
    const useCustomPermissions = body.useCustomPermissions === 'on'
        || body.useCustomPermissions === 'true'
        || body.useCustomPermissions === true;
    let ids = body.customPermissionIds;
    if (!ids) ids = [];
    if (!Array.isArray(ids)) ids = [ids];
    return {
        useCustomPermissions: useCustomPermissions && ids.length > 0,
        customPermissionIds: filterValidPermissionIds(ids)
    };
}

async function assertCanGrantPermissions(actor, permissionIds) {
    if (actor.role === 'SA') return true;
    if (actor.role === 'Admin' && !permissionIds.length) return true;
    const actorEffective = await getEffectivePermissionSet(actor);
    const invalid = permissionIds.filter((id) => !actorEffective.has(id));
    if (invalid.length) {
        throw new Error('Bạn không thể cấp quyền vượt quá quyền của chính mình.');
    }
    return true;
}

function summaryFromPermissionIds(ids, meta = {}) {
    const grouped = {};
    for (const id of ids) {
        const p = registry.PERMISSION_BY_ID[id];
        if (!p) continue;
        if (!grouped[p.group]) grouped[p.group] = [];
        grouped[p.group].push({ id: p.id, label: p.label });
    }
    return {
        count: ids.length,
        grouped,
        ...meta
    };
}

async function getUserPermissionSummary(userLike) {
    if (!userLike?.role || userLike.role === 'SA') {
        return getRolePermissionSummary('SA');
    }
    const roleSummary = await getRolePermissionSummary(userLike.role);
    if (userLike.useCustomPermissions && userLike.customPermissionIds?.length) {
        return {
            role: userLike.role,
            roleLabel: registry.ROLE_LABELS[userLike.role] || userLike.role,
            source: 'user_custom',
            useCustomPermissions: true,
            rolePermissionCount: roleSummary?.count || 0,
            ...summaryFromPermissionIds(filterValidPermissionIds(userLike.customPermissionIds), {
                isCustom: true
            })
        };
    }
    return {
        ...roleSummary,
        useCustomPermissions: false,
        source: roleSummary?.source || 'suggested'
    };
}

function canEditUserPermissions(actorRole) {
    return ['SA', 'Admin'].includes(actorRole);
}

/** Khởi tạo cache khi server boot (gọi từ server.js) */
async function init() {
    try {
        await refreshCache();
    } catch (e) {
        console.warn('[permissionService] Cache init deferred:', e.message);
        cache.matrix = registry.buildMatrixFromRolePermissions(registry.buildDefaultRolePermissionMap());
        cache.roleSets = buildRoleSetsFromMatrix(cache.matrix);
        cache.loadedAt = Date.now();
    }
}

module.exports = {
    init,
    refreshCache,
    ensureCache,
    roleHasPermission,
    roleHasPermissionSync,
    userHasPermission,
    userHasPermissionSync,
    getRolePermissionIds,
    getEffectivePermissionIds,
    saveRolePermissions,
    resetRoleToSuggested,
    getSuggestedForRole,
    getRolePermissionSummary,
    getUserPermissionSummary,
    getAssignableRolesForActor,
    assertCanAssignRole,
    assertCanGrantPermissions,
    parsePermissionFieldsFromBody,
    buildSessionUserPayload,
    canEditUserPermissions,
    filterValidPermissionIds
};
