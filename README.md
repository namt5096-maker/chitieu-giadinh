# 💸 Chi tiêu gia đình

Web app quản lý thu chi gia đình: biểu đồ, ngân sách theo nhóm, cảnh báo hạn mức, thẻ tín dụng và hoàn tiền, báo cáo gọn.
Chạy miễn phí trên GitHub Pages. Dữ liệu đồng bộ qua **Google Sheet của riêng bạn** (không nằm trong repo này).

## Cài đồng bộ Google Sheet (làm 1 lần, khoảng 10 phút, trên máy tính)

1. Vào https://sheets.new để tạo một Google Sheet mới, đặt tên ví dụ **Chi tiêu gia đình**.
2. Trên menu chọn **Tiện ích mở rộng → Apps Script**.
3. Xoá hết code mẫu, dán toàn bộ nội dung file [`apps-script/Code.gs`](apps-script/Code.gs).
4. Ở dòng `const MAT_KHAU = 'doi-mat-khau-nay-di';`, đổi thành mật khẩu riêng của gia đình (ít nhất 8 ký tự). Bấm 💾 **Lưu**.
5. Chọn hàm **caiDat** ở thanh trên, bấm **▶ Chạy**, rồi cấp quyền:
   - Chọn tài khoản Google của bạn.
   - Nếu hiện "Google chưa xác minh ứng dụng này", bấm **Nâng cao → Đi tới … (không an toàn)**. Đây là script của chính bạn nên không sao.
   - Bấm **Cho phép**.
6. Bấm **Triển khai → Tác vụ triển khai mới**:
   - Bấm ⚙️, chọn loại **Ứng dụng web**.
   - **Thực thi với tư cách:** Tôi.
   - **Người có quyền truy cập:** **Bất kỳ ai**.
   - Bấm **Triển khai** rồi **sao chép URL ứng dụng web** (có dạng `https://script.google.com/macros/s/…/exec`).
7. Mở app trên máy tính, vào **⚙️ Cài đặt → Đồng bộ**, dán URL và mật khẩu, rồi bấm **🔗 Kết nối & đồng bộ**.

> Sau này nếu sửa code Apps Script: **Triển khai → Quản lý tác vụ triển khai → ✏️ → Phiên bản: Phiên bản mới → Triển khai** (giữ nguyên URL).

## Cài lên iPhone

1. Trên máy tính đã kết nối, vào **Cài đặt → 📲 Mã cài đặt cho thiết bị khác**.
2. Trên iPhone, mở link app bằng **Safari**, bấm nút **Chia sẻ ⬆️ → Thêm vào MH chính**.
3. Mở app từ icon vừa tạo trên màn hình chính, vào **⚙️ Cài đặt**, dán **mã cài đặt** (gửi qua Zalo cho chính mình rồi sao chép), sau đó bấm **Kết nối**.
   - Lưu ý: app trên màn hình chính có bộ nhớ riêng, tách khỏi Safari, nên phải dán mã **trong app**.

## Bảo mật

- Repo này công khai nhưng **không chứa dữ liệu hay mật khẩu**. Dữ liệu nằm trong Google Sheet của bạn.
- Mật khẩu gia đình chỉ nằm trong Apps Script (riêng tư) và trên từng thiết bị đã kết nối.
- Không commit file sao lưu `chitieu_backup_*.json` lên repo.
