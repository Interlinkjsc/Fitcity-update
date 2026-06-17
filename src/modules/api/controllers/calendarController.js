const WorkoutSession = require('../../programs/models/workoutSessionModel.js');
const User = require('../../users/models/userModel.js'); 
const Branch = require('../../crm/models/branchModel.js');
const Contract = require('../../contracts/models/contractModel.js');
const workoutService = require('../../programs/services/workoutService.js');

const getColorByStatus = (status) => {
    switch (status) {
        case 'Scheduled': return '#3788d8'; // Xanh dương
        case 'In_Progress': return '#f39c12'; // Cam
        case 'Completed': return '#2ecc71'; // Xanh lá
        case 'Cancelled': return '#e74c3c'; // Đỏ
        case 'No_Show': return '#95a5a6'; // Xám
        case 'Pending_Admin': return '#f59e0b'; // Vàng cam - chờ duyệt
        default: return '#3788d8';
    }
};

const isValidDate = (d) => d instanceof Date && !isNaN(d);

exports.getSessions = async (req, res) => {
    try {
        const query = {};
        
        console.log('--- Calendar API Request ---');
        const user = req.user || {};
        const { start: qStart, end: qEnd, branchId } = req.query;

        console.log('User:', { id: user._id || user.id, role: user.role });
        console.log('Params:', { qStart, qEnd, branchId });

        // Phân quyền theo Role
        if (user.role === 'Client') {
            query.client = user._id || user.id;
        } else if (user.role === 'PT') {
            query.pt = user._id || user.id;
        } else if (['Manager', 'Sales'].includes(user.role)) {
            if (user.branch) query.branch = user.branch;
        } else if (['Admin', 'SA', 'CEO', 'SA'].includes(user.role)) {
            // Admin có thể lọc theo chi nhánh nếu được truyền vào
            if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== '') {
                query.branch = branchId;
            }
        }
        
        // Nếu truyền tham số start / end từ FullCalendar
        if (qStart && qEnd) {
            const dateStart = new Date(qStart);
            const dateEnd = new Date(qEnd);

            if (isValidDate(dateStart) && isValidDate(dateEnd)) {
                query.scheduledTime = {
                    $gte: dateStart,
                    $lte: dateEnd
                };
            }
        }

        console.log('Mongoose Query:', JSON.stringify(query));

        const sessions = await WorkoutSession.find(query)
            .populate('client', 'name email phone')
            .populate('pt', 'name email avatar')
            .populate('branch', 'name')
            .sort({ scheduledTime: 1 })
            .lean();

        console.log(`Found ${sessions.length} sessions.`);

        // Map sang định dạng FullCalendar chuẩn
        const mappedData = sessions.map(session => {
            try {
                const clientName = (session.client && typeof session.client === 'object') ? (session.client.name || 'Unknown') : 'Unknown Client';
                const ptName = (session.pt && typeof session.pt === 'object') ? (session.pt.name || 'Unknown') : 'Unknown PT';
                const branchName = (session.branch && typeof session.branch === 'object') ? (session.branch.name || 'Cơ sở') : 'Cơ sở';
                
                const workoutTitle = session.workoutPlan || session.title || 'Buổi tập';

                const title = user.role === 'Client'
                    ? ptName
                    : clientName;

                const start = session.startTime || session.scheduledTime;
                let end = session.endTime;
                if (!end && start) {
                    const startMs = new Date(start).getTime();
                    const defaultMins =
                        session.status === 'Completed' && session.startTime
                            ? 60
                            : 60;
                    end = new Date(startMs + defaultMins * 60 * 1000);
                }

                return {
                    id: session._id,
                    title: title,
                    start: start,
                    end: end,
                    color: getColorByStatus(session.status),
                    extendedProps: {
                        status: session.status,
                        notes: session.notes,
                        pt: ptName,
                        ptName: ptName,
                        client: clientName,
                        branchName: branchName,
                        workoutTitle: workoutTitle
                    }
                };
            } catch (err) {
                console.error('Mapping error for session:', session._id, err.message);
                return null;
            }
        }).filter(item => item !== null);

        // FullCalendar JSON feed expects an array of events (not wrapped)
        res.status(200).json(mappedData);
    } catch (err) {
        console.error('CRITICAL CALENDAR ERROR:', err);
        res.status(500).json({
            status: 'fail',
            message: 'Internal Server Error: ' + err.message
        });
    }
};

exports.cancelSession = async (req, res) => {
    try {
        const sessionId = req.params.id;
        const session = await WorkoutSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({ status: 'fail', message: 'Không tìm thấy buổi tập!' });
        }

        // Quyền hủy: PT của buổi đó hoặc Client của buổi đó
        const isClient = req.user.role === 'Client' && session.client.toString() === req.user.id;
        const isPT = req.user.role === 'PT' && session.pt.toString() === req.user.id;
        const isAdmin = ['Admin', 'Manager', 'SA'].includes(req.user.role);

        if (!isClient && !isPT && !isAdmin) {
            return res.status(403).json({ status: 'fail', message: 'Bạn không có quyền hủy buổi tập này.' });
        }

        // Kiểm tra rule hủy trước 24h (dựa trên scheduledTime, không phải startTime)
        const now = new Date();
        const baseTime = session.scheduledTime || session.startTime;
        const startTime = new Date(baseTime);
        
        // Hiệu số milliseconds
        const diffMs = startTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours <= 24) {
            return res.status(400).json({
                status: 'fail',
                message: 'Không thể hủy buổi tập. Bạn chỉ được phép hủy lịch trước 24 giờ so với giờ tập dự kiến!'
            });
        }

        session.status = 'Cancelled';
        await session.save();

        res.status(200).json({
            status: 'success',
            message: 'Đã hủy buổi tập thành công.'
        });
    } catch (err) {
        res.status(500).json({
            status: 'fail',
            message: err.message
        });
    }
};

exports.scanQr = async (req, res) => {
    try {
        const sessionId = req.params.id;
        const authUserId = req.user.id;
        
        if (req.user.role !== 'PT') {
            return res.status(403).json({
                status: 'fail',
                message: 'Chỉ PT mới có quyền quét mã QR điểm danh.'
            });
        }
        
        const session = await workoutService.processQrScan(sessionId, authUserId);
        
        let message = 'Cập nhật trạng thái thành công';
        if (session.status === 'In_Progress') {
            message = 'Đã bắt đầu điểm danh (In Progress). Hãy cho khách hàng xem màn hình xác nhận nếu cần.';
        } else if (session.status === 'Completed') {
            message = 'Buổi tập đã hoàn thành. Hệ thống đã cấn trừ 1 buổi trong hợp đồng, và ghi nhận hoa hồng thành công.';
        }

        res.status(200).json({
            status: 'success',
            message,
            data: session
        });
    } catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message
        });
    }
};
