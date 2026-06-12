const mongoose = require('mongoose');

let mongoServer;

async function connectTestDb() {
    if (mongoose.connection.readyState === 1) {
        return;
    }
    const uri = process.env.MONGODB_URI;
    if (uri) {
        await mongoose.connect(uri);
        return;
    }
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create({
        binary: { version: '7.0.14' }
    });
    await mongoose.connect(mongoServer.getUri());
}

async function disconnectTestDb() {
    if (mongoose.connection.readyState === 0) {
        return;
    }
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongoServer) {
        await mongoServer.stop();
        mongoServer = null;
    }
}

async function clearCollections(...models) {
    for (const Model of models) {
        await Model.deleteMany({});
    }
}

module.exports = { connectTestDb, disconnectTestDb, clearCollections };
