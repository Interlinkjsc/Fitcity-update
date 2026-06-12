/**
 * Migration: amount cũ → amountBeforeVat, vatRate=10, tính vatAmount & total
 * Usage: node scripts/migrate-expense-vat.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Expense = require('../src/modules/finance/models/expenseModel');
const { calculateExpenseVat } = require('../src/utils/expenseVatHelper');

async function run() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity';
    await mongoose.connect(uri);

    const expenses = await Expense.find({
        $or: [{ amountBeforeVat: { $exists: false } }, { total: { $exists: false } }]
    });

    let updated = 0;
    for (const exp of expenses) {
        const legacy = exp.amount ?? exp.total ?? 0;
        if (!legacy) continue;

        const vat = calculateExpenseVat({
            amountBeforeVat: legacy,
            vatRate: exp.vatRate ?? 10,
            vatExempt: false
        });

        exp.amountBeforeVat = vat.amountBeforeVat;
        exp.vatRate = vat.vatRate;
        exp.vatAmount = vat.vatAmount;
        exp.total = vat.total;
        exp.amount = vat.total;
        if (!exp.taxDocumentType) exp.taxDocumentType = 'INPUT_VAT';

        await exp.save();
        updated += 1;
    }

    console.log(`Expenses migrated: ${updated}`);
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
