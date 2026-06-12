require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/Fitcity';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const MealPlan = require('../src/modules/programs/models/mealPlanModel');

  // Backfill status for old meal plans that have no status field
  const r1 = await MealPlan.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'approved' } }
  );
  console.log('Set status=approved (no status field):', r1.modifiedCount, 'documents');

  // Fix active=true meal plans that have invalid/missing status
  const r2 = await MealPlan.updateMany(
    { active: true, status: { $nin: ['approved', 'pending_admin', 'rejected'] } },
    { $set: { status: 'approved' } }
  );
  console.log('Fix active meal plans with invalid status:', r2.modifiedCount, 'documents');

  await mongoose.disconnect();
  console.log('Migration complete.');
}

migrate().catch(e => { console.error(e); process.exit(1); });
