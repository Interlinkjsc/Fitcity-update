const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../modules/users/models/userModel.js');
const { hash } = require('../utils/encryption');

(async () => {
    await mongoose.connect('mongodb://localhost:27017/crm_fitness');
    
    const email = 'client@test.com';
    const emailH = hash(email);
    console.log('Looking for emailHash:', emailH);
    
    const user = await User.findOne({ emailHash: emailH }).select('+password');
    
    if (!user) {
        console.log('❌ User NOT FOUND in DB!');
        // List all users with 'test' in emailHash or name
        const allUsers = await User.find({}).select('name email emailHash role').limit(10);
        console.log('Sample users in DB:');
        allUsers.forEach(u => console.log(`  - ${u.name} | emailHash: ${u.emailHash} | role: ${u.role}`));
    } else {
        console.log('✅ User found:', user.name, '| role:', user.role);
        console.log('   Stored password hash:', user.password);
        
        const match = await bcrypt.compare('123456', user.password);
        console.log('   Password "123456" matches:', match);
    }
    
    process.exit(0);
})();
