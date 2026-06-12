/**
 * Seed dữ liệu mẫu cho Thư viện Giáo trình Bài tập
 * Chạy: node scripts/seed_workout_programs.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const WorkoutProgram = require('../src/modules/programs/models/workoutProgramModel.js');

const programs = [
    // ===== GIẢM CÂN =====
    {
        title: 'Đốt mỡ toàn thân - Cơ bản',
        goal: 'Giảm cân',
        level: 'Beginner',
        description: 'Chương trình kết hợp cardio và sức mạnh nhẹ, phù hợp người mới bắt đầu muốn giảm cân an toàn.',
        duration: '4 tuần',
        sessionsPerWeek: 3,
        exercises: [
            { name: 'Khởi động Cardio nhẹ (đi bộ nhanh)', sets: '1', reps: '10 phút', rest: '-', notes: 'Tốc độ vừa phải, tăng nhịp tim dần' },
            { name: 'Squat không tạ', sets: '3', reps: '15', rest: '45s', notes: 'Giữ lưng thẳng, đầu gối không vượt mũi chân' },
            { name: 'Lunge tại chỗ', sets: '3', reps: '12/chân', rest: '45s', notes: 'Bước dài, hạ gối sau gần sàn' },
            { name: 'Push-up (chống đẩy)', sets: '3', reps: '10-12', rest: '60s', notes: 'Có thể chống đẩy trên gối nếu chưa quen' },
            { name: 'Plank', sets: '3', reps: '30s', rest: '30s', notes: 'Giữ cơ thể thẳng, siết bụng' },
            { name: 'Jumping Jacks', sets: '3', reps: '20', rest: '30s', notes: 'Nhịp nhanh, tay vỗ phía trên đầu' },
            { name: 'Mountain Climbers', sets: '3', reps: '20', rest: '45s', notes: 'Giữ hông ổn định, tốc độ vừa phải' },
            { name: 'Giãn cơ toàn thân', sets: '1', reps: '5 phút', rest: '-', notes: 'Kéo giãn các nhóm cơ chính' },
        ]
    },
    {
        title: 'HIIT Đốt mỡ nâng cao',
        goal: 'Giảm cân',
        level: 'Intermediate',
        description: 'Chương trình HIIT cường độ cao, xen kẽ bài tập sức mạnh và cardio để tối ưu đốt calo sau tập.',
        duration: '6 tuần',
        sessionsPerWeek: 4,
        exercises: [
            { name: 'Warm-up động (Dynamic stretching)', sets: '1', reps: '5 phút', rest: '-', notes: 'Xoay khớp, đá chân, vặn hông' },
            { name: 'Burpees', sets: '4', reps: '12', rest: '30s', notes: 'Full range: squat → plank → push-up → jump' },
            { name: 'Kettlebell Swing', sets: '4', reps: '15', rest: '30s', notes: 'Lực đẩy từ hông, không dùng tay kéo' },
            { name: 'Box Jump', sets: '3', reps: '10', rest: '45s', notes: 'Nhảy lên, bước xuống (không nhảy xuống)' },
            { name: 'Battle Rope', sets: '4', reps: '30s', rest: '30s', notes: 'Xen kẽ tay, giữ squat nhẹ' },
            { name: 'Dumbbell Thruster', sets: '3', reps: '12', rest: '45s', notes: 'Squat + đẩy tạ qua đầu liên tục' },
            { name: 'Sprint tại chỗ (High Knees)', sets: '4', reps: '30s', rest: '20s', notes: 'Nâng gối cao ngang hông' },
            { name: 'Cool-down + Foam Rolling', sets: '1', reps: '5 phút', rest: '-', notes: 'Lăn cơ đùi, bắp chân, lưng' },
        ]
    },

    // ===== TĂNG CƠ =====
    {
        title: 'Xây dựng cơ bắp - Nền tảng',
        goal: 'Tăng cơ',
        level: 'Beginner',
        description: 'Giáo trình tập trung vào các bài compound cơ bản, xây nền tảng sức mạnh cho người mới.',
        duration: '8 tuần',
        sessionsPerWeek: 3,
        exercises: [
            { name: 'Barbell Squat (Squat tạ đòn)', sets: '4', reps: '8-10', rest: '90s', notes: 'Hạ đến song song hoặc thấp hơn, giữ core chắc' },
            { name: 'Bench Press (Đẩy ngực tạ đòn)', sets: '4', reps: '8-10', rest: '90s', notes: 'Hạ tạ đến ngực, đẩy lên hết tay' },
            { name: 'Deadlift (Kéo tạ chết)', sets: '3', reps: '6-8', rest: '120s', notes: 'Giữ lưng thẳng, lực kéo từ chân và hông' },
            { name: 'Overhead Press (Đẩy vai)', sets: '3', reps: '10', rest: '60s', notes: 'Đứng thẳng, đẩy tạ qua đầu' },
            { name: 'Barbell Row (Chèo tạ đòn)', sets: '3', reps: '10', rest: '60s', notes: 'Gập người 45°, kéo tạ về bụng' },
            { name: 'Dumbbell Curl (Cuốn tay trước)', sets: '3', reps: '12', rest: '45s', notes: 'Giữ khuỷu tay cố định' },
            { name: 'Tricep Dip (Hít xà kép)', sets: '3', reps: '10', rest: '60s', notes: 'Có thể dùng máy hỗ trợ' },
        ]
    },
    {
        title: 'Hypertrophy - Phát triển cơ nâng cao',
        goal: 'Tăng cơ',
        level: 'Advanced',
        description: 'Chương trình chia nhóm cơ (Split), volume cao, tối ưu phì đại cơ cho người đã có nền tảng.',
        duration: '12 tuần',
        sessionsPerWeek: 5,
        exercises: [
            { name: 'Incline Dumbbell Press', sets: '4', reps: '10-12', rest: '60s', notes: 'Ghế nghiêng 30-45°, siết ngực trên' },
            { name: 'Cable Fly (Kéo cáp ngực)', sets: '4', reps: '12-15', rest: '45s', notes: 'Ép tay vào nhau ở đỉnh, giữ 1s' },
            { name: 'Weighted Pull-up', sets: '4', reps: '8', rest: '90s', notes: 'Thêm tạ dây đeo thắt lưng' },
            { name: 'T-Bar Row', sets: '4', reps: '10', rest: '60s', notes: 'Siết lưng giữa, không dùng quán tính' },
            { name: 'Leg Press', sets: '4', reps: '12', rest: '90s', notes: 'Chân rộng = nhấn mông, chân hẹp = nhấn đùi trước' },
            { name: 'Romanian Deadlift', sets: '4', reps: '10', rest: '60s', notes: 'Cảm nhận kéo giãn hamstring, không khóa gối' },
            { name: 'Lateral Raise + Front Raise Superset', sets: '3', reps: '12+12', rest: '45s', notes: 'Không nghỉ giữa 2 bài, nghỉ sau superset' },
            { name: 'Face Pull', sets: '3', reps: '15', rest: '45s', notes: 'Kéo về mặt, xoay tay ra ngoài ở đỉnh' },
        ]
    },

    // ===== SỨC BỀN =====
    {
        title: 'Cardio Endurance - Sức bền tim mạch',
        goal: 'Sức bền',
        level: 'Beginner',
        description: 'Xây dựng nền tảng sức bền tim phổi, phù hợp người muốn cải thiện thể lực tổng thể.',
        duration: '6 tuần',
        sessionsPerWeek: 4,
        exercises: [
            { name: 'Chạy bộ nhẹ (Jogging)', sets: '1', reps: '15-20 phút', rest: '-', notes: 'Duy trì nhịp tim 60-70% HRmax' },
            { name: 'Đạp xe tại chỗ', sets: '1', reps: '15 phút', rest: '-', notes: 'Resistance vừa phải, nhịp đều' },
            { name: 'Rowing Machine (Máy chèo)', sets: '3', reps: '500m', rest: '60s', notes: 'Kỹ thuật: Chân → Lưng → Tay' },
            { name: 'Jump Rope (Nhảy dây)', sets: '5', reps: '1 phút', rest: '30s', notes: 'Nhảy 2 chân, nhịp ổn định' },
            { name: 'Farmer\'s Walk', sets: '3', reps: '40m', rest: '60s', notes: 'Tạ nặng 2 tay, vai thả, bước nhanh' },
            { name: 'Bodyweight Circuit: Squat + Push-up + Sit-up', sets: '3', reps: '15 mỗi bài', rest: '60s', notes: 'Không nghỉ giữa các bài trong 1 vòng' },
        ]
    },

    // ===== DẺO DAI =====
    {
        title: 'Flexibility & Mobility',
        goal: 'Dẻo dai',
        level: 'Beginner',
        description: 'Cải thiện độ linh hoạt khớp và kéo giãn cơ, giảm nguy cơ chấn thương, phục hồi nhanh hơn.',
        duration: '4 tuần',
        sessionsPerWeek: 5,
        exercises: [
            { name: 'Cat-Cow Stretch', sets: '2', reps: '10', rest: '-', notes: 'Hít vào uốn lưng, thở ra cong lưng' },
            { name: 'World\'s Greatest Stretch', sets: '2', reps: '5/bên', rest: '-', notes: 'Lunge + xoay thân + mở ngực' },
            { name: 'Hip 90/90 Stretch', sets: '2', reps: '30s/bên', rest: '-', notes: 'Giữ lưng thẳng, xoay hông' },
            { name: 'Pigeon Pose', sets: '2', reps: '45s/bên', rest: '-', notes: 'Kéo giãn hông sâu, thở đều' },
            { name: 'Thoracic Spine Rotation', sets: '2', reps: '10/bên', rest: '-', notes: 'Nằm nghiêng, xoay ngực mở rộng' },
            { name: 'Hamstring Stretch (Chân thẳng)', sets: '2', reps: '30s/chân', rest: '-', notes: 'Gập người về trước, giữ gối thẳng' },
            { name: 'Shoulder Dislocates (Gậy)', sets: '2', reps: '10', rest: '-', notes: 'Dùng gậy hoặc dây, vòng qua đầu chậm' },
            { name: 'Deep Squat Hold', sets: '3', reps: '30s', rest: '15s', notes: 'Giữ squat sâu, gót chân chạm sàn' },
        ]
    },

    // ===== TỔNG HỢP =====
    {
        title: 'Full Body Functional Training',
        goal: 'Tổng hợp',
        level: 'Intermediate',
        description: 'Kết hợp sức mạnh, sức bền và linh hoạt trong một buổi tập. Phù hợp người muốn thể lực toàn diện.',
        duration: '8 tuần',
        sessionsPerWeek: 4,
        exercises: [
            { name: 'Warm-up: Jump Rope + Dynamic Stretch', sets: '1', reps: '5 phút', rest: '-', notes: 'Nhảy dây 2p + kéo giãn động 3p' },
            { name: 'Turkish Get-up', sets: '3', reps: '3/bên', rest: '60s', notes: 'Tạ nhẹ, tập trung kỹ thuật và kiểm soát' },
            { name: 'Front Squat', sets: '4', reps: '8', rest: '90s', notes: 'Tạ trước vai, khuỷu tay cao, core siết' },
            { name: 'Single-arm Dumbbell Row', sets: '3', reps: '10/tay', rest: '45s', notes: 'Chống 1 tay trên ghế, kéo tạ về hông' },
            { name: 'Push Press', sets: '3', reps: '8', rest: '60s', notes: 'Hơi nhún gối rồi đẩy tạ lên mạnh' },
            { name: 'Sled Push', sets: '4', reps: '20m', rest: '60s', notes: 'Đẩy xe sled, giữ thân nghiêng 45°' },
            { name: 'Hanging Leg Raise', sets: '3', reps: '12', rest: '45s', notes: 'Treo xà, nâng chân thẳng lên ngang hông' },
            { name: 'Cool-down Yoga Flow', sets: '1', reps: '5 phút', rest: '-', notes: 'Child pose → Cobra → Downward dog' },
        ]
    },
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Xóa dữ liệu cũ
        await WorkoutProgram.deleteMany({});
        console.log('🗑️  Cleared old workout programs');

        // Insert mới
        const result = await WorkoutProgram.insertMany(programs);
        console.log(`✅ Seeded ${result.length} workout programs`);

        // Thống kê
        const goals = [...new Set(programs.map(p => p.goal))];
        goals.forEach(g => {
            const count = programs.filter(p => p.goal === g).length;
            console.log(`   📂 ${g}: ${count} giáo trình`);
        });

        await mongoose.disconnect();
        console.log('✅ Done!');
    } catch (err) {
        console.error('❌ Seed error:', err);
        process.exit(1);
    }
}

seed();
