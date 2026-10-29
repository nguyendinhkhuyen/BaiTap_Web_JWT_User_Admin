# Kết quả kiểm tra

Môi trường: Windows, Node.js v22.23.1, npm 10.9.8.

## Tự động

Đã chạy `npm test`: **17/17 test pass, 0 fail**.

- Đăng nhập đúng/sai/thiếu dữ liệu.
- JWT được ký, có vai trò và thời hạn; không nhận role tự khai báo từ client.
- User truy cập được hồ sơ và học phần; không đọc được API admin và không tạo được học phần.
- Admin xem tài khoản không lộ password hash, tạo được học phần để user đọc.
- JWT thiếu, rác, sửa payload, hết hạn, sai issuer/audience/thuật toán/chữ ký, tài khoản không tồn tại và `alg:none` đều bị chặn.
- Kiểm tra dữ liệu học phần, mã trùng, JSON sai, header không cache và giới hạn đăng nhập.
- Server phục vụ trang HTML thành công.

## Trên trình duyệt

Đã thao tác thực tế qua giao diện:

1. Điền tài khoản user và click Đăng nhập: HTTP 200, đúng role user.
2. Tải danh sách học phần: hiển thị 3 học phần mẫu.
3. User gọi danh sách tài khoản: HTTP 403 FORBIDDEN.
4. Thử sửa JWT: HTTP 401 TOKEN_INVALID.
5. Đăng xuất rồi đăng nhập admin: HTTP 200, khu vực quản trị xuất hiện.
6. Admin gọi danh sách tài khoản: HTTP 200.
7. Admin thêm WEB401: HTTP 201, danh sách hiển thị 4 học phần.

Giao diện đã được quan sát ở khung trình duyệt hẹp. Chưa kiểm tra mọi kích thước màn hình hoặc mọi trình duyệt. Dữ liệu thêm trong kiểm thử không được đóng gói; ứng dụng khởi động với 3 học phần mẫu ban đầu.
