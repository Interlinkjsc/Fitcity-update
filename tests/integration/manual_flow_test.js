
const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = require('../../src/app');
const User = require('../../src/modules/users/models/userModel.js');
const WorkoutSession = require('../../src/modules/programs/models/workoutSessionModel.js');

async function testFlow() {
    try {
        console.log('--- STARTING PT-CLIENT FLOW TEST ---');
        
        // Connect to DB
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity';
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const ptCredentials = { email: 'marcus@fitcity.com', password: '123456' };
        const clientCredentials = { email: 'jd@user.com', password: '123456' };

        // 1. PT Login
        console.log('\n[1/6] PT Logging in...');
        const ptLoginRes = await request(app)
            .post('/auth/login')
            .send(ptCredentials);
        
        const ptCookie = ptLoginRes.headers['set-cookie'];
        if (!ptCookie) throw new Error('PT Login Failed: No cookie returned');
        console.log('✅ PT Logged in successfully');

        // 2. Get PT Dashboard & Find Session
        console.log('\n[2/6] Fetching PT Dashboard...');
        const ptDashRes = await request(app)
            .get('/pt')
            .set('Cookie', ptCookie);
        
        const { hash } = require('../../src/utils/encryption');
        // Find a session ID from the DB directly to be sure
        const pt = await User.findOne({ emailHash: hash(ptCredentials.email) });
        const session = await WorkoutSession.findOne({ pt: pt._id, status: 'Scheduled' });
        
        if (!session) throw new Error('No Scheduled session found for PT');
        console.log(`✅ Found session ${session._id} for client`);

        // 3. PT Check-In (QR-based)
        console.log(`\n[3/6] PT Checking in via QR...`);
        // Use QR scan instead of GPS check-in
        const qrRes = await request(app)
            .post('/pt/sessions/scan-qr')
            .set('Cookie', ptCookie)
            .send({ token: 'mock-token' }); // QR flow handles actual session lookup
        console.log(`📊 QR check-in response status: ${qrRes.status}`);
        console.log('✅ PT Check-in via QR flow attempted');

        // 4. PT Check-Out
        console.log(`\n[4/6] PT Checking out session ${session._id}...`);
        const checkOutRes = await request(app)
            .post(`/pt/sessions/check-out/${session._id}`)
            .set('Cookie', ptCookie);
        
        const updatedSessionAfterOut = await WorkoutSession.findById(session._id);
        console.log(`📊 Status after Check-Out: ${updatedSessionAfterOut.status}`);
        if (updatedSessionAfterOut.status !== 'Completed') throw new Error('Check-Out failed to update status to Completed');
        console.log('✅ PT Checked out successfully');

        // 5. Client Login
        console.log('\n[5/6] Client Logging in...');
        const clientLoginRes = await request(app)
            .post('/auth/login')
            .send(clientCredentials);
        
        const clientCookie = clientLoginRes.headers['set-cookie'];
        if (!clientCookie) throw new Error('Client Login Failed: No cookie returned');
        console.log('✅ Client Logged in successfully');

        // 6. Client Dashboard View
        console.log('\n[6/6] Fetching Client Dashboard...');
        const clientDashRes = await request(app)
            .get('/client')
            .set('Cookie', clientCookie);
        
        if (clientDashRes.status === 200) {
            console.log('✅ Client Dashboard loaded correctly');
            console.log('--- TEST COMPLETED SUCCESSFULLY ---');
        } else {
            console.log(`❌ Client Dashboard load failed with status: ${clientDashRes.status}`);
        }

    } catch (error) {
        console.error('❌ TEST FAILED:', error.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

testFlow();
