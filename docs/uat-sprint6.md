# UAT Script — Sprint 6 (Client & hoàn thiện)

**Thời lượng đề xuất:** ~1 buổi (2–3 giờ)  
**Môi trường:** Staging / local với seed E2E  
**Test case đầy đủ:** `docs/test-cases/MASTER-TEST-CASES.md` (TC-CLI*, TC-CTR30, TC-E2E-02)

## Vai trò cần có

| Role | Tài khoản (seed) |
|------|------------------|
| Client A (referrer) | E2E client có `referralCode` |
| Client B (F1) | Đăng ký với mã A |
| PT | E2E PT |
| Admin/Accountant | Thanh toán HĐ |

## Checklist

### S6-01 Nhật ký bữa ăn
- [ ] Client đăng nhập → `/client/nutrition`
- [ ] Ghi nhật ký Sáng/Trưa/Tối → flash thành công, hiện trong danh sách hôm nay
- [ ] Ghi lại cùng loại bữa → cập nhật (không trùng 2 dòng)

### S6-02 Affiliate F1
- [ ] Client A: `/auth/profile` → thấy mã giới thiệu, F1 count
- [ ] Đăng ký Client B với mã A → B có `referredBy`
- [ ] Thanh toán HĐ B → `Paid` → A nhận Reward type Gift tại `/client/rewards`
- [ ] F2 chỉ hiển thị số/lịch sử, không tự thưởng

### S6-03 Lộ trình tuần
- [ ] PT: `/pt/workout-assignments` → gán program cho Client
- [ ] Client: `/client/workouts` → thấy block "Lộ trình tuần"

### S6-04 Progress filter
- [ ] `/client/progress?days=30|60|90` → biểu đồ chỉ trong khoảng ngày

### S6-05 Coupon hộp quà
- [ ] Reward type `Gift` hiển thị icon hộp quà trên `/client/rewards`

### S6-06 Meal plan detail
- [ ] PT: `/pt/meal-plans` → Chi tiết → trang macro + bữa ăn (không còn stub text)

### Regression nhanh
- [ ] Landing lead, admin leads funnel
- [ ] PT daily report, expense VAT export

## Ghi chú PO

- Affiliate reward mặc định: **200.000đ**, hết hạn **90 ngày**
- F2 v1: hiển thị only
