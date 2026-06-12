# Phân Tích Yêu Cầu Tính Năng FitCity

Dưới đây là bản phân tích chi tiết các vấn đề và yêu cầu tính năng bạn đã liệt kê. Bản phân tích này bóc tách từng yêu cầu thành các hạng mục Frontend, Backend và Database để chuẩn bị cho quá trình phát triển (KHÔNG sửa code).

---

## 1. Quản lý lịch tập (Schedule Management)
* **Yêu cầu:** Form lịch tập tham khảo Google Calendar (3 dạng: ngày, giờ, tuần, tháng) theo từng chi nhánh. Trạng thái: Đang chờ, Đang tập, Đã tập xong.
* **Phân tích:**
  - **Frontend:** Cần tích hợp thư viện Calendar mạnh mẽ (ví dụ: `FullCalendar.js` hoặc cấu trúc tương tự). Giao diện cần có bộ lọc (filter) theo chi nhánh (Branch) và chế độ xem (Day, Week, Month).
  - **Database:** Bảng `Session` (hoặc `Booking`) cần cập nhật trường `status` sử dụng enum: `['pending', 'in_progress', 'completed']`.
  - **Backend:** Cập nhật các API Get Sessions để hỗ trợ lấy dữ liệu theo khoảng thời gian (start_date, end_date) phục vụ cho thư viện Calendar, và lọc theo `branch_id`. Thêm API/Logic để tự động/thủ công chuyển đổi trạng thái buổi tập.

---

## 2. Giáo trình cho từng mục tiêu (Client Curriculum)
* **Yêu cầu:** Client - Giáo trình cho từng mục tiêu, xem dạng text.
* **Phân tích:**
  - **Database:** Cần tạo mới model `Curriculum` (Giáo trình) liên kết với trường Mục tiêu (Goal). (Ví dụ: Goal: Tăng cân -> Curriculum: Nội dung text...).
  - **Frontend (Client App):** Thêm tab "Giáo trình".
  - **Backend:** API `/api/clients/curriculum` trả về nội dung giáo trình dựa trên `goal` của user đăng nhập.

---

## 3. Chức năng của PT (PT Dashboard & Actions)
* **Yêu cầu:** PT - Điền text cho mục tiêu trong tạo màn hình dinh dưỡng. PT tạo hợp đồng (chỉ tạo, không edit/xóa). Dashboard PT đổi thành tổng doanh số (KPI). Thêm tab xem tiền lương, thu nhập, thống kê chi tiết.
* **Phân tích:**
  - **Tạo Dinh dưỡng:** Form `/pt/meal-plans/create` cần thêm trường text input tự do cho "Mục tiêu" (như: tăng cân, siết mỡ...). Model `MealPlan` cần có trường `goal` (String).
  - **Tạo Hợp đồng:** PT cần được cấp quyền tạo hợp đồng. Cần tạo 1 trang form trên web/app cho PT tạo hợp đồng. **Bảo mật:** Middleware `authorizeRoles` trên các route Sửa/Xóa hợp đồng (PUT/DELETE) tuyệt đối không cấp quyền cho role `PT`, chỉ cho `Admin/Manager`.
  - **Dashboard & KPI PT:** 
    - Dashboard hiện tại cần thay widget thành "Tổng doanh số KPI".
    - Backend cần viết query Aggregation tính tổng tiền các hợp đồng mà PT đó mang lại hoặc số buổi đã dạy (tùy định nghĩa KPI).
    - Tạo thêm tab "Thu nhập & KPI": Liệt kê các dòng tiền hoa hồng, lương cơ bản theo tháng.

---

## 4. Yêu cầu đổi PT từ Khách hàng (Client Request PT Change)
* **Yêu cầu:** Tài khoản khách có form yêu cầu đổi PT, báo về cho Quản lý chi nhánh (trừ PT).
* **Phân tích:**
  - **Database:** Tạo bảng/model `PTChangeRequest` (clientId, currentPtId, reason, status: pending/approved/rejected, branchId).
  - **Backend:** Tạo API POST để khách hàng gửi yêu cầu. Khi có request, bắn thông báo (Notification/Socket) tới những User có role `Manager` hoặc `Admin` thuộc cùng `branchId`.
  - **Frontend:** Thêm modal/form "Yêu cầu đổi PT" trong trang thông tin gói tập của Khách.

---

## 5. Cập nhật Admin Dashboard & Quản lý (Admin Features)
* **Yêu cầu:** Tab phạt, kỷ luật nhân sự. Tạo reward gán cho khách từ tab voucher. Đổi "hiện diện" thành "số người online" (PT + Khách). Form đăng ký gói tập có mục tiêu (Gym, Gym kid, Pilates), bỏ số lượng buổi.
* **Phân tích:**
  - **Phạt/Kỷ luật:** Cần model `Discipline` (staffId, amount, reason, date). Admin có tab riêng để CRUD và filter theo ngày, tháng. Dữ liệu này sẽ liên kết sang bảng lương.
  - **Gán Reward/Voucher:** Hiện tại Voucher đang chung, cần thêm trường `assigned_to` (clientId) để cấp riêng rẽ cho từng khách.
  - **Số người Online:** Để chính xác, phải dùng Redis lưu session hoặc Websocket (Socket.io) để biết ai đang online/mở app. Hoặc dùng mốc `last_active_at` trong 5 phút. Khái niệm "Hiện diện" trước đây (checkin) sẽ thay thế.
  - **Gói tập (Packages):** Model `Package` thêm trường `target_type` (Enum: gym, gym_kid, pilates). Xóa/ẩn trường `session_count` (hoặc chuyển thành nullable/unlimited) vì giờ tính theo thời hạn gói.

---

## 6. Chi tiết Nhân viên & Tài khoản (Staff & Account)
* **Yêu cầu:** Thêm trường tên ngân hàng, số tài khoản. Tự đổi được password. Phân luồng tài khoản theo ma trận phân quyền.
* **Phân tích:**
  - **Database:** Bảng `User` hoặc bảng Profile của Staff thêm `bank_name`, `bank_account_number`.
  - **Tài khoản:** Chức năng đổi mật khẩu cá nhân (Change Password profile) cho toàn bộ user.
  - **Ma trận phân quyền (RBAC):** Cần rà soát lại middleware `checkPermission`. Nếu phức tạp, cần tách thành bảng `Permissions` và `RolePermissions` thay vì hardcode role.

---

## 7. Quản lý lương thưởng (Payroll system)
* **Yêu cầu:** Sửa form thanh toán nhân sự chi tiết (Doanh thu, hoa hồng, thuế, BHXH). Tổng lương + hoa hồng chia 2 đợt (tự động đề xuất ngày 5 và 15).
* **Phân tích:**
  - **Logic:** Phiếu lương (Payslip) sẽ gộp Lương cơ bản + Hoa hồng (từ hợp đồng/buổi tập) - Phạt (Discipline) - Thuế - BHXH.
  - **Tự động hóa:** Thiết lập `node-cron` chạy vào cuối tháng để chốt số. Hệ thống tự động tách tổng tiền làm 2 khoản (50%-50%) và tạo 2 phiếu chi (Payment Request) vào ngày 5 và ngày 15.

---

## 8. Coupon (Lỗi không Edit được)
* **Phân tích:** Đây là vấn đề fix bug. Cần kiểm tra route `PUT /api/coupons/:id` và hàm Update trong Controller. Khả năng cao do sai cú pháp update Mongoose hoặc lỗi validation khi submit form trên frontend.

---

## 9. Rules Hệ thống: Hủy lịch, Bảo lưu, Thanh lý HĐ
* **Yêu cầu:** Khách hủy lịch < 24h chỉ từ PT. Phí bảo lưu 200k/tháng (max 12 tháng). Hợp đồng sau 15 ngày chưa đóng đủ tự động thanh lý.
* **Phân tích:**
  - **Hủy lịch:** Trong API Cancel Session, lấy `startTime` trừ `now`. Nếu `< 24h` và user call API có role `Client` -> Bắn lỗi "Vui lòng liên hệ PT để hủy". Nếu role là `PT`/`Admin` -> Cho phép.
  - **Bảo lưu (Pause):** Khi bấm Bảo lưu hợp đồng, bắt buộc chọn số tháng (<= 12). Hệ thống sinh ra một Invoice/Payment ghi nhận nợ `số tháng * 200.000đ`.
  - **Thanh lý (Liquidation):** Dùng `node-cron` chạy daily. Tìm các `Contract` có `status = active/pending_payment`, `createdAt < (now - 15 days)`, tổng tiền đã đóng < giá trị HĐ -> tự động update `status = liquidated`.

---

## 10. Lịch sử buổi tập của Khách hàng
* **Yêu cầu:** Khách xem được tất cả lịch sử buổi tập.
* **Phân tích:** Cần đảm bảo UI App/Web của khách hàng gọi tới API `GET /api/sessions/client-history`. API này query các buổi tập có `clientId` của khách, trạng thái là `completed`, sắp xếp theo `date` giảm dần để khách xem lại log/tiến độ.
