# 🚀 FITCITY PROJECT: AGILE DEVELOPMENT CHECKLIST

Bản kế hoạch này tổng hợp 23 yêu cầu/lỗi được phân chia thành các Sprint để triển khai theo mô hình Agile. Đảm bảo 100% Test Coverage và xử lý Edge Cases.

---

## 📅 SPRINT 1: SECURITY & CORE DATABASE (Tuần 1)
*Tập trung vào nền tảng bảo mật, phân quyền và cấu trúc dữ liệu mới.*

- [x] **1. Ma trận phân quyền (RBAC) & Tài khoản**
    - [x] Phân luồng tài khoản theo ma trận: SA, Admin, CEO, Manager, Accountant, Marketing, PT, Sales, Client.
    - [x] Triển khai Branch Isolation (Cô lập dữ liệu theo chi nhánh) cho Manager/PT/Client.
    - [x] Mở tính năng tự đổi mật khẩu cho tất cả tài khoản (`/auth/change-password`).
    - [x] **Test Plan:**
        - [x] Unit: Test middleware `checkPermission` với matrix 7+ roles.
        - [x] Integration: Kiểm tra Branch Isolation (Manager A không thấy User chi nhánh B).
        - [x] Security: Chặn các trường nhạy cảm (Tax Documents) dựa trên vai trò.
- [x] **2. Cập nhật Database Models**
    - [x] `Staff`: Thêm Bank Name, Account Number.
    - [x] `ServicePackage`: Thêm mục tiêu, option không giới hạn buổi.
    - [x] `WorkoutSession`: Chuẩn hóa 3 trạng thái.
    - [x] **Test Plan:**
        - [x] Unit: Validate schema với các trường dữ liệu mới (Expect: fail nếu thiếu trường bắt buộc).
        - [x] Edge Case: Nhập số tài khoản ngân hàng quá dài hoặc chứa ký tự đặc biệt.
- [x] **3. Sửa lỗi tồn đọng hệ thống**
    - [x] Fix lỗi không edit được Coupon.
    - [x] **Test Plan:** 
        - [x] Integration: API `PATCH /admin/coupons/:id` phải trả về 200 và dữ liệu DB được cập nhật.

---

## 📅 SPRINT 2: SCHEDULE & QR AUTOMATION (Tuần 2)
*Tự động hóa quy trình tập luyện và giao diện lịch.*

- [x] **4. Giao diện Lịch tập (Google Calendar Style)**
    - [x] View Ngày/Tuần/Tháng.
    - [x] **Test Plan:**
        - [x] Unit: Hàm helper parse dữ liệu session sang định dạng FullCalendar.
        - [x] Edge Case: Lịch tập kéo dài xuyên ngày, hoặc nhiều buổi tập trùng giờ.
- [x] **5. Xác thực trạng thái bằng QR Code (Logic 3 bước)**
    - [x] Quét lần 1: Chuyển sang "Đang tập".
    - [x] Quét lần 2: Chuyển sang "Đã tập xong" + Tự động tính hoa hồng.
    - [x] **Test Plan:**
        - [x] Unit: `workoutService.processQrScan` xử lý logic chuyển trạng thái.
        - [x] Integration: Luồng quét QR từ phía PT app gửi lên Server.
        - [x] Edge Case: Quét kết thúc khi chưa quét bắt đầu; Quét khi session đã quá giờ quá lâu.
- [x] **6. Quy tắc hủy lịch 24h**
    - [x] Chỉ PT có quyền hủy/đổi lịch và phải trước 24h.
    - [x] **Test Plan:**
        - [x] Unit: Logic so sánh `scheduledTime` và `Date.now()`.
        - [x] Edge Case: Hủy lịch đúng thời điểm 23h59p59s trước buổi tập.
- [x] **7. Lịch sử tập luyện Client**
    - [x] Khách xem lịch sử và giáo trình dạng text.
    - [x] **Test Plan:**
        - [x] Integration: Đảm bảo dữ liệu trả về chỉ thuộc về User đang đăng nhập.

---

## 📅 SPRINT 3: CONTRACT & CRONJOB LOGIC (Tuần 3)
*Quản lý hợp đồng chặt chẽ và tự động hóa quy trình nghiệp vụ.*

- [x] **8. Quyền hạn Hợp đồng của PT**
    - [x] PT được tạo hợp đồng nhưng không được sửa/xóa.
    - [x] **Test Plan:**
        - [x] Integration: Gửi request `POST /pt/contracts` (Success) và `PUT /pt/contracts/:id` (Fail - 403).
- [x] **9. Hệ thống Cronjob Tự động thanh lý**
    - [x] Thanh lý hợp đồng nợ quá 15 ngày.
    - [x] Phí bảo lưu 200k/tháng, thanh lý sau tối đa 12 tháng.
    - [x] **Test Plan:**
        - [x] Unit: Test logic tìm hợp đồng thỏa mãn điều kiện thanh lý.
        - [x] Edge Case: Giả lập thời gian hệ thống tới mốc 15 ngày 1 giây.
- [x] **10. Quản lý Voucher & Reward**
    - [x] Admin gán trực tiếp Reward cho khách.
    - [x] **Test Plan:**
        - [x] Integration: Kiểm tra User nhận được notification khi được tặng Voucher.
- [x] **11. Đăng ký mục tiêu mới**
    - [x] Form đăng ký có mục tiêu: Gym, Gym Kid, Pilates.
    - [x] **Test Plan:** Validate dữ liệu đầu vào của gói tập.

---

## 📅 SPRINT 4: PAYROLL & HR MANAGEMENT (Tuần 4)
*Minh bạch hóa thu nhập, KPI và quản lý nhân sự.*

- [x] **12. Dashboard & Thống kê cho PT**
    - [x] Dashboard đổi thành "Tổng doanh số (KPI)".
    - [x] Mở tab xem chi tiết: Tiền lương, Thu nhập, KPI.
- [x] **13. Quản lý Kỷ luật (Admin)**
    - [x] Thêm tab phạt, kỷ luật nhân sự (Số tiền, nội dung, lọc ngày/tháng).
- [x] **14. Thanh toán lương chi tiết & 2 kỳ**
    - [x] Form thanh toán tách biệt: Doanh thu, Hoa hồng, Thuế, BHXH.
    - [x] Tự động đề xuất thanh toán 2 đợt (Ngày 5 và 15 tháng tiếp theo).
- [x] **15. Yêu cầu thay đổi PT (Client)**
    - [x] Khách gửi request dạng text về cho Manager (PT không thấy).
    - [x] Manager phê duyệt -> Đổi PT trong hợp đồng & Thông báo cho khách.

---

## 📅 SPRINT 5: REALTIME & FINAL POLISH (Tuần 5)
*Hoàn thiện trải nghiệm người dùng và tính năng nâng cao.*

- [x] **16. Realtime Online Tracking**
    - [x] Sử dụng Socket.io đếm số người (PT & Khách) đang online thực tế trên Dashboard.
    - [x] Tích hợp thông báo realtime khi Manager duyệt đổi PT.
- [x] **17. Tối ưu hóa UI/UX & Final Test**
    - [x] Đảm bảo 100% các file test đều PASS (62/62 suites passing).
    - [x] Kiểm tra tính tương thích trên Mobile (Responsive).

---

## 🛠️ TEST STRATEGY (100% COVERAGE)
1. **Unit Test:** Mỗi logic (ví dụ: tính phí bảo lưu) phải có file `.test.js` đi kèm.
2. **Integration Test:** Test luồng đi từ Login -> Quét QR -> Thanh toán lương.
3. **Edge Case:** Luôn test với dữ liệu biên (VD: Hợp đồng đúng 15 ngày, hủy lịch đúng 24h00).
4. **CI/CD:** Chạy test tự động mỗi khi push code.

---
*Ghi chú: Checklist này sẽ được cập nhật liên tục dựa trên tiến độ thực tế.*
