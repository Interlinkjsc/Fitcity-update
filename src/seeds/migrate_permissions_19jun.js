/**
 * One-time migration: add contract.create, staff_management.view, staff_management.create
 * to Marketing, Sales, CEO roles that previously didn't have them.
 */
const mongoose = require('mongoose');
const RolePermission = require('../modules/platform/models/rolePermissionModel');
require('dotenv').config();

const ADDITIONS = {
    Marketing: ['contract.create', 'contract.view', 'staff_management.view', 'staff_management.create'],
    Sales:     ['staff_management.view', 'staff_management.create'],
    CEO:       ['contract.create', 'contract.view'],
};

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_fitness');
    console.log('Connected');

    for (const [role, toAdd] of Object.entries(ADDITIONS)) {
        const doc = await RolePermission.findOne({ role });
        if (!doc) {
            await RolePermission.create({ role, permissionIds: toAdd, isCustom: true });
            console.log(`Created ${role}: ${toAdd.join(', ')}`);
        } else {
            const current = new Set(doc.permissionIds);
            const added = [];
            for (const p of toAdd) {
                if (!current.has(p)) { current.add(p); added.push(p); }
            }
            if (added.length) {
                doc.permissionIds = [...current];
                await doc.save();
                console.log(`Updated ${role} +[${added.join(', ')}]`);
            } else {
                console.log(`${role}: already has all permissions`);
            }
        }
    }

    console.log('Done');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
