const mongoose = require('mongoose');
const User = require('../modules/users/models/userModel.js');
const Branch = require('../modules/crm/models/branchModel.js');
const ServicePackage = require('../modules/programs/models/servicePackageModel.js');
const Contract = require('../modules/contracts/models/contractModel.js');
const WorkoutSession = require('../modules/programs/models/workoutSessionModel.js');
const Lead = require('../modules/crm/models/leadModel.js');
const bcrypt = require('bcryptjs');

// Database URI
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/Fitcity';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('DB Connection Successful for Seeding!'))
    .catch(err => console.log('DB Connection failed', err));

const plainPassword = '123456';

const importData = async () => {
    try {
        // Clear Existing Data
        await User.deleteMany();
        await Branch.deleteMany();
        await ServicePackage.deleteMany();
        await Contract.deleteMany();
        await WorkoutSession.deleteMany();
        await Lead.deleteMany();

        // 1. Tạo Branch
        const branchD1 = await Branch.create({
            name: 'FitCity District 1',
            address: '123 Nguyen Hue, Ho Chi Minh City',
            phone: '0901234567',
            operatingHours: { open: '06:00', close: '22:00' },
            status: 'Open'
        });

        // 2. Tạo Staff Roles
        const admin = await User.create({
            name: 'Admin Root',
            email: 'admin@fitcity.com',
            password: plainPassword,
            role: 'SA',
            status: 'Active'
        });

        const pt1 = await User.create({
            name: 'Marcus Thorne',
            email: 'marcus@fitcity.com',
            password: plainPassword,
            role: 'PT',
            branch: branchD1._id,
            status: 'Active',
            avatar: 'https://i.pravatar.cc/150?u=marcus'
        });

        const sales1 = await User.create({
            name: 'Jenny Sales',
            email: 'sales@fitcity.com',
            password: plainPassword,
            role: 'Sales',
            branch: branchD1._id,
            status: 'Active'
        });

        // 3. Tạo Clients
        const rawClients = [
            { name: 'Johnathan Doe', email: 'jd@user.com' },
            { name: 'Rebecca Smith', email: 'rs@user.com' },
            { name: 'Thomas Brown', email: 'tb@user.com' },
            { name: 'Emily White', email: 'ew@user.com' }
        ];
        
        const clients = [];
        for (let c of rawClients) {
            const u = await User.create({
                ...c,
                password: plainPassword,
                role: 'Client',
                branch: branchD1._id,
                status: 'Active',
                avatar: `https://i.pravatar.cc/150?u=${c.email}`
            });
            clients.push(u);
        }

        // 4. Tạo Gói dịch vụ
        const pkgYoga = await ServicePackage.create({
            name: 'Yoga Zen 3 Months',
            type: 'Yoga',
            price: 5000000,
            duration: 90,
            sessions: 24,
            status: 'Active'
        });

        const pkgPT = await ServicePackage.create({
            name: 'Personal Training Elite 10',
            type: 'PT',
            price: 8000000,
            duration: 30,
            sessions: 10,
            status: 'Active'
        });

        // 5. Tạo Hợp đồng
        const c1 = await Contract.create({
            client: clients[0]._id,
            servicePackage: pkgPT._id,
            branch: branchD1._id,
            sales: sales1._id,
            pt: pt1._id,
            basePrice: 8000000,
            totalAmount: 8800000,
            paymentStatus: 'Paid',
            paidAmount: 8800000,
            contractStatus: 'Active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            remainingSessions: 10
        });

        await Contract.create({
            client: clients[1]._id,
            servicePackage: pkgYoga._id,
            branch: branchD1._id,
            sales: sales1._id,
            basePrice: 5000000,
            totalAmount: 5500000,
            paymentStatus: 'Paid',
            paidAmount: 5500000,
            contractStatus: 'Active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            remainingSessions: 24
        });

        // 6. Tạo Buổi tập Lịch sử (Completed)
        for(let i=0; i<30; i++) {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - (Math.floor(Math.random() * 20) + 1));
            await WorkoutSession.create({
                client: clients[Math.floor(Math.random()*clients.length)]._id,
                pt: pt1._id,
                contract: c1._id,
                branch: branchD1._id,
                scheduledTime: pastDate,
                startTime: pastDate,
                endTime: new Date(pastDate.getTime() + 3600000),
                status: 'Completed',
                clientConfirmation: { isConfirmed: true, time: pastDate }
            });
        }

        // 7. Tạo Luồng Chờ xác nhận (Completed but not confirmed)
        await WorkoutSession.create({
            client: clients[0]._id,
            pt: pt1._id,
            contract: c1._id,
            branch: branchD1._id,
            scheduledTime: new Date(Date.now() - 7200000), // 2 hours ago
            startTime: new Date(Date.now() - 7200000),
            endTime: new Date(Date.now() - 3600000),
            status: 'Completed',
            clientConfirmation: { isConfirmed: false }
        });

        // 8. Tạo Lịch tương lai (Scheduled)
        for(let i=0; i<3; i++) {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + (i + 1) * 2);
            await WorkoutSession.create({
                client: clients[i % clients.length]._id,
                pt: pt1._id,
                contract: c1._id,
                branch: branchD1._id,
                scheduledTime: futureDate,
                status: 'Scheduled'
            });
        }

        // 9. Tạo Leads mẫu (Marketing)
        await Lead.create([
            { name: 'Hoàng Minh', phone: '0912333444', email: 'minh@test.com', branch: branchD1._id, interestedPackage: 'Gym', source: 'Website', status: 'New' },
            { name: 'Lê Thu Thảo', phone: '0988777666', email: 'thao@test.com', branch: branchD1._id, interestedPackage: 'Yoga', source: 'Website', status: 'Contacted', notes: 'Đã gọi tư vấn, hẹn ngày mai qua xem CSVC' }
        ]);

        console.log('✅ FMS PRO DATA SEEDED SUCCESSFULLY!');
        process.exit(0);
    } catch (error) {
        console.error('❌ SEEDING ERROR:', error);
        process.exit(1);
    }
};

importData();
