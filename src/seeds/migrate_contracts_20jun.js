/**
 * Migration 20/06:
 * 1. Activate Draft contracts that have Deposit payment
 * 2. Set paidAt = updatedAt for existing Paid contracts that have no paidAt
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_fitness');
    const Contract = require('../modules/contracts/models/contractModel');

    // Fix 1: Draft + Deposit → Active
    const depositResult = await Contract.updateMany(
        { contractStatus: 'Draft', paymentStatus: 'Deposit' },
        { $set: { contractStatus: 'Active' } }
    );
    console.log(`Activated ${depositResult.modifiedCount} Deposit contracts (Draft → Active)`);

    // Fix 2: Paid contracts without paidAt → set paidAt = updatedAt
    const paidContracts = await Contract.find({ paymentStatus: 'Paid', paidAt: { $exists: false } });
    let count = 0;
    for (const c of paidContracts) {
        c.paidAt = c.updatedAt || c.createdAt;
        await c.save();
        count++;
    }
    console.log(`Set paidAt on ${count} existing paid contracts`);

    console.log('Done');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
