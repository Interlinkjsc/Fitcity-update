# Chạy FitCity Local để Test

## Yêu cầu
- Node.js 18+
- MongoDB đang chạy (hoặc dùng MongoDB Atlas free tier)

## Cách 1: Dùng MongoDB trên máy (nếu đã cài)
```bash
# Mở terminal 1 - start MongoDB
mongod --dbpath /tmp/fitcity-db

# Mở terminal 2 - start app
cd Fitcity-developer
cp .env.local .env
npm install
node src/server.js
```

## Cách 2: Dùng MongoDB Atlas (free, không cần cài)
1. Vào https://cloud.mongodb.com → tạo free cluster
2. Lấy connection string
3. Sửa .env: MONGODB_URI=mongodb+srv://...

## File .env cần có:
```
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/fitcity_local
SESSION_SECRET=any-random-string
ENCRYPTION_KEY=12345678901234567890123456789012
QR_HMAC_SECRET=any-random-string
```

## Sau khi server chạy:
1. Vào http://localhost:3001/auth/login
2. Chạy seed: node src/seeds/seedAdmin.js
3. Login: admin@fitcity.com / 123456
