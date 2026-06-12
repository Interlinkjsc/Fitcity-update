const mongoose = require('mongoose');
const path = require('path');

// Load env from server env file or use MONGODB_URI env var
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/Fitcity';

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const MealPlan = require('../src/modules/programs/models/mealPlanModel');

  // Set all existing meal plans without status to 'approved' (they were active before)
  const result = await MealPlan.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'approved', rejectionReason: '' } }
  );
  console.log('Migrated meal plans without status:', result.modifiedCount);

  // Also set active: true for all approved meal plans that have active: true already (no change needed)
  // Set active: false for pending/rejected ones (they were just created)
  const result2 = await MealPlan.updateMany(
    { status: 'pending_admin' },
    { $set: { active: false } }
  );
  console.log('Set active:false for pending meal plans:', result2.modifiedCount);

  await mongoose.disconnect();
  console.log('Migration complete');
}

migrate().catch(e => { console.error(e); process.exit(1); });
