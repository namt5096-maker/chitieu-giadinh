# 💸 Chi tiêu gia đình

Web app quản lý thu chi cho **nhiều gia đình**. Mỗi gia đình tự đăng ký bằng **số điện thoại và mật khẩu**, dữ liệu của từng tài khoản tách riêng.
Tài khoản **quản trị** xem và quản lý được tất cả tài khoản.

Tính năng: biểu đồ, ngân sách theo nhóm, cảnh báo hạn mức, thẻ tín dụng và hoàn tiền, báo cáo gọn, cài lên iPhone như một app.
Chạy miễn phí: giao diện trên GitHub Pages, máy chủ và dữ liệu trên Google Sheet và Apps Script của chủ hệ thống (không nằm trong repo này).

## Cài máy chủ (làm 1 lần, trên máy tính)

1. Vào https://sheets.new để tạo một Google Sheet mới, đặt tên ví dụ **Chi tiêu – Máy chủ**.
2. Chọn **Tiện ích mở rộng → Apps Script**, xoá code mẫu rồi dán toàn bộ file [`apps-script/Code.gs`](apps-script/Code.gs).
3. Ở đầu file, điền **SĐT và mật khẩu admin** vào `ADMIN_SDT` / `ADMIN_MK`, sau đó bấm 💾 **Lưu**.
   *(Chỉ điền trong Apps Script, không đưa lên GitHub.)*
4. Chọn hàm **caiDat** rồi bấm **▶ Chạy** và cấp quyền.
   - Nếu hiện "Google chưa xác minh ứng dụng này", bấm **Nâng cao → Đi tới… → Cho phép**.
5. Bấm **Triển khai → Tác vụ triển khai mới → ⚙️ Ứng dụng web**, chọn:
   - *Thực thi với tư cách:* **Tôi**
   - *Người có quyền truy cập:* **Bất kỳ ai**
6. Bấm **Triển khai**, rồi sao chép **URL ứng dụng web** (`https://script.google.com/macros/s/…/exec`).
7. Dán URL đó vào file [`config.js`](config.js): `window.API_URL = '…/exec';`, rồi commit và push. Từ đó mọi người mở web là đăng ký hoặc đăng nhập được ngay.

> Sửa code Apps Script sau này: **Triển khai → Quản lý tác vụ triển khai → ✏️ → Phiên bản mới → Triển khai** (URL giữ nguyên).

## Dữ liệu trong Google Sheet

- `TaiKhoan`: danh sách tài khoản. Mật khẩu chỉ lưu dạng **băm (hash) có salt**, không ai đọc được mật khẩu gốc.
- `DuLieu`: các giao dịch, cột *Tài khoản* cho biết giao dịch thuộc gia đình nào.
- `CauHinhTK`: nhóm chi, hạn mức và thẻ của từng tài khoản.

## Cài lên iPhone

Mở link web bằng **Safari**, bấm **Chia sẻ ⬆️ → Thêm vào MH chính**, mở icon ₫ vừa tạo rồi đăng nhập bằng SĐT và mật khẩu.

## Bảo mật

- Mật khẩu được băm SHA-256 nhiều vòng có salt. Phiên đăng nhập dùng token ký HMAC, hết hạn sau 180 ngày, và bị huỷ khi đổi hoặc đặt lại mật khẩu.
- Sai mật khẩu 5 lần sẽ bị chặn đăng nhập 10 phút.
- Tài khoản bị khoá bị đăng xuất ngay ở lần đồng bộ kế tiếp.
- Repo công khai nhưng **không chứa dữ liệu, mật khẩu hay SĐT admin**.
