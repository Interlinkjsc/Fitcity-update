const BodyMetric = require('../models/bodyMetricModel.js');
const Contract = require('../../contracts/models/contractModel.js');
const notificationService = require('../../platform/services/notificationService');

exports.getMyClientsForMetrics = async (req, res, next) => {
    try {
        const ptId = req.session.user.id;
        const contracts = await Contract.find({ pt: ptId, contractStatus: 'Active' })
            .populate('client', 'name avatar email phone')
            .populate('servicePackage', 'name');
        
        const clients = [];
        const seenIds = new Set();
        
        contracts.forEach(contract => {
            if (contract.client && !seenIds.has(contract.client._id.toString())) {
                const clientObj = contract.client.toObject();
                clientObj.activePackageName = contract.servicePackage ? contract.servicePackage.name : 'N/A';
                
                clients.push(clientObj);
                seenIds.add(contract.client._id.toString());
            }
        });

        res.render('pt/metrics/clients', { clients, activePage: 'metrics' });
    } catch (err) {
        next(err);
    }
};

exports.getAddMetricForm = async (req, res, next) => {
    try {
        const { clientId } = req.params;
        const client = await Contract.findOne({ client: clientId }).populate('client', 'name avatar');
        if (!client || !client.client) {
            req.flash('error_msg', 'Không tìm thấy khách hàng phù hợp để cập nhật chỉ số.');
            return res.redirect('/pt/metrics');
        }

        res.render('pt/metrics/form', { client: client.client, activePage: 'metrics' });
    } catch (err) {
        next(err);
    }
};

exports.getMetricHistory = async (req, res, next) => {
    try {
        const { clientId } = req.params;
        const ptId = req.session.user.id;

        const contract = await Contract.findOne({ client: clientId, pt: ptId }).populate('client', 'name avatar');
        if (!contract || !contract.client) {
            req.flash('error_msg', 'Bạn không có quyền xem lịch sử chỉ số của khách hàng này.');
            return res.redirect('/pt/metrics');
        }

        const metrics = await BodyMetric.find({ client: clientId }).sort({ date: -1 });
        return res.render('pt/metrics/history', {
            client: contract.client,
            metrics,
            activePage: 'metrics'
        });
    } catch (err) {
        next(err);
    }
};

exports.saveBodyMetric = async (req, res, next) => {
    try {
        const { clientId } = req.params;
        const ptId = req.session.user.id;
        
        await BodyMetric.create({
            client: clientId,
            pt: ptId,
            weight: Number(req.body.weight),
            height: Number(req.body.height),
            bodyFat: Number(req.body.bodyFat),
            muscleMass: Number(req.body.muscleMass),
            visceralFat: Number(req.body.visceralFat),
            water: Number(req.body.water) || 0,
            minerals: Number(req.body.minerals) || 0,
            protein: Number(req.body.protein) || 0,
            measurements: {
                chest: Number(req.body.chest) || 0,
                waist: Number(req.body.waist) || 0,
                hips: Number(req.body.hips) || 0,
                bicep: Number(req.body.bicep) || 0,
                thigh: Number(req.body.thigh) || 0
            },
            notes: req.body.notes
        });

        await notificationService.pushNotification(
            clientId,
            'Chỉ số cơ thể mới đã cập nhật',
            'PT của bạn vừa cập nhật kết quả đo InBody mới nhất. Hãy kiểm tra ngay biểu đồ tiến độ nhé!',
            'Info',
            '/client/progress'
        );

        req.flash('success_msg', 'Đã lưu chỉ số cơ thể thành công cho khách hàng.');
        res.redirect('/pt/metrics');
    } catch (err) {
        next(err);
    }
};

exports.getMyProgress = async (req, res, next) => {
    try {
        const clientId = req.session.user.id;
        const days = parseInt(req.query.days, 10);
        const allowed = [30, 60, 90];
        const rangeDays = allowed.includes(days) ? days : 90;

        const from = new Date();
        from.setHours(0, 0, 0, 0);
        from.setDate(from.getDate() - rangeDays);

        const metrics = await BodyMetric.find({
            client: clientId,
            date: { $gte: from }
        }).sort({ date: 1 });

        res.render('client/progress', {
            metrics,
            rangeDays,
            activePage: 'progress'
        });
    } catch (err) {
        next(err);
    }
};

exports.getClientAddMetricForm = async (req, res, next) => {
  try {
    const clientId = req.session.user.id;
    const contract = await Contract.findOne({
      client: clientId, contractStatus: 'Active'
    }).populate('pt', 'name').lean();
    res.render('client/metrics/form', {
      contract,
      activePage: 'progress'
    });
  } catch (err) { next(err); }
};

exports.clientSaveBodyMetric = async (req, res, next) => {
  try {
    const clientId = req.session.user.id;
    const contract = await Contract.findOne({
      client: clientId, contractStatus: 'Active'
    }).lean();
    const ptId = contract ? contract.pt : null;

    await BodyMetric.create({
      client: clientId,
      pt: ptId,
      weight: Number(req.body.weight) || 0,
      height: Number(req.body.height) || 0,
      bodyFat: Number(req.body.bodyFat) || 0,
      muscleMass: Number(req.body.muscleMass) || 0,
      visceralFat: Number(req.body.visceralFat) || 0,
      water: Number(req.body.water) || 0,
      minerals: Number(req.body.minerals) || 0,
      protein: Number(req.body.protein) || 0,
      measurements: {
        chest: Number(req.body.chest) || 0,
        waist: Number(req.body.waist) || 0,
        hips: Number(req.body.hips) || 0,
        bicep: Number(req.body.bicep) || 0,
        thigh: Number(req.body.thigh) || 0
      },
      notes: req.body.notes || ''
    });

    if (ptId) {
      await notificationService.pushNotification(
        ptId,
        'Khách hàng vừa cập nhật chỉ số',
        `${req.session.user.name} vừa tự nhập chỉ số cơ thể mới. Hãy kiểm tra tiến độ.`,
        'Info', '/pt/metrics', clientId
      );
    }
    req.flash('success_msg', 'Đã lưu chỉ số cơ thể thành công!');
    res.redirect('/client/progress');
  } catch (err) { next(err); }
};

