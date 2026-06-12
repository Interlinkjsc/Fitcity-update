const MealLog = require('../models/mealLogModel');

function startOfDay(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDay(d = new Date()) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

exports.logMeal = async ({ clientId, logDate, mealType, description, calories, compliance }) => {
    const day = startOfDay(logDate ? new Date(logDate) : new Date());
    return MealLog.findOneAndUpdate(
        { client: clientId, logDate: day, mealType },
        {
            client: clientId,
            logDate: day,
            mealType,
            description: description || '',
            calories: Number(calories) || 0,
            compliance: compliance || 'Followed'
        },
        { upsert: true, new: true }
    );
};

exports.getLogsForDate = async (clientId, date = new Date()) => {
    const day = startOfDay(date);
    return MealLog.find({ client: clientId, logDate: { $gte: day, $lte: endOfDay(day) } }).sort({
        mealType: 1
    });
};

exports.getRecentLogs = async (clientId, days = 7) => {
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - (days - 1));
    return MealLog.find({ client: clientId, logDate: { $gte: from } }).sort({ logDate: -1, mealType: 1 });
};
