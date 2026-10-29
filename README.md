# Campus Portal — Bài tập JWT và phân quyền

Ứng dụng mẫu cho môn **Công nghệ lập trình Web**, thực hiện phương án JWT trong đề. Frontend HTML/CSS/JavaScript; backend Node.js + Express. Không cần cài cơ sở dữ liệu. Không triển khai phương án OAuth2 vì đây là lựa chọn thay thế trong đề.

## 1. Chạy ứng dụng

1. Cài **Node.js 22 trở lên** từ https://nodejs.org/ (kèm npm).
2. Giải nén ZIP, mở thư mục `jwt-web-assignment` bằng VS Code.
3. Mở Terminal tại thư mục chứa `package.json`, chạy:

```sh
npm ci
npm start
```

4. Mở **http://127.0.0.1:3000** trên trình duyệt.
5. Dừng server bằng `Ctrl+C`.

Lần chạy đầu cần Internet để tải thư viện. `npm start` tự tạo `.env` với khóa JWT ngẫu nhiên nếu chưa có. Không cần tự sao chép `.env.example`. Server và client chạy cùng nguồn nên không cần cấu hình CORS.

Nếu PowerShell báo không chạy được `npm.ps1`, thay `npm` bằng `npm.cmd`. Nếu cổng 3000 đang dùng, sửa `PORT=3001` trong `.env`, chạy lại và mở cổng mới. Không mở trực tiếp `public/index.html` bằng cách nhấp đúp; cần dùng địa chỉ server ở trên.

## 2. Tài khoản mẫu

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| user | user@example.com | User@123456 |
| admin | admin@example.com | Admin@123456 |

Nút “Điền tài khoản User/Admin” chỉ điền form. Bạn phải bấm **Đăng nhập** để gửi yêu cầu thật tới server. Không chọn role bằng một giá trị tự khai báo từ client: server lấy role từ tài khoản đã xác thực.

## 3. Chức năng tương ứng yêu cầu đề

| Yêu cầu | Cách thực hiện | File chính |
| --- | --- | --- |
| User click Đăng nhập ở web | Form gọi `POST /api/auth/login` | `public/app.js` |
| Server xác thực đăng nhập | Kiểm tra email và bcrypt password hash | `src/app.js`, `src/data.js` |
| Server trả JWT về client | Ký HS256, có `sub`, `role`, `iat`, `exp`, `iss`, `aud` | `src/app.js` |
| Client gửi JWT ở các lần gọi API | Header `Authorization: Bearer <JWT>` | Hàm `api()` trong `public/app.js` |
| Server xác thực JWT | Kiểm tra chữ ký, thuật toán, thời hạn, issuer, audience, tài khoản | `src/middleware/auth.js` |
| Phân quyền user/admin | Middleware `authorize(...)` chạy sau `authenticate(...)` | `src/app.js` |
| Authorized / không cho phép | JSON `authorized` và HTTP 200/201, 401, 403 | Các API được bảo vệ |

Luồng xử lý:

```text
Trình duyệt                 Server
   |  POST email/password      |
   | ------------------------> | Kiểm tra bcrypt; lấy role từ dữ liệu server
   | <------------------------ | Ký và trả accessToken JWT
   |                           |
   | GET /api/admin/users      |
   | Authorization: Bearer JWT |
   | ------------------------> | authenticate: JWT có hợp lệ không?
   |                           | authorize: role có được phép không?
   | <------------------------ | 200 cho admin / 403 cho user / 401 cho JWT lỗi
```

**Phân biệt:** `401 Unauthorized` = chưa xác thực thành công; `403 Forbidden` = đã xác thực nhưng thiếu quyền. Đề dùng “unauthorized” theo nghĩa không cho phép truy cập; ứng dụng dùng đúng hai mã HTTP theo từng tình huống. Lỗi dữ liệu của một admin hợp lệ có thể trả `400` với `authorized: true`: quyền truy cập và tính hợp lệ dữ liệu là hai bước khác nhau.

## 4. Thực hành trên giao diện

1. Chưa đăng nhập: nhấn “Thông tin của tôi” → `401 TOKEN_MISSING`.
2. Điền email user và mật khẩu sai → đăng nhập trả `401 INVALID_CREDENTIALS`.
3. Đăng nhập tài khoản user đúng → `200`, server trả JWT. Mở “Kiểm tra JWT của phiên hiện tại” để xem token và payload.
4. Nhấn “Tải danh sách” hoặc “Danh sách học phần” → `200`, danh sách được lấy từ API.
5. Với user, nhấn “Danh sách tài khoản” → `403 FORBIDDEN`.
6. Nhấn “Thử thiếu JWT” → `401`; phiên đang có không bị xóa vì đây là yêu cầu thử riêng.
7. Nhấn “Thử JWT bị sửa” → client sửa role trong payload nhưng giữ chữ ký cũ → `401 TOKEN_INVALID`. JWT thật vẫn được giữ để thực hành tiếp.
8. Đăng xuất, đăng nhập admin. Nhấn “Danh sách tài khoản” → `200`.
9. Dùng khu vực Quản trị để thêm học phần. Server kiểm tra role và trả `201`. Đăng nhập lại user sẽ đọc được học phần vừa thêm.
10. Thử hết hạn: sửa `JWT_EXPIRES_IN=10s` trong `.env`, khởi động lại server, đăng nhập, chờ hơn 10 giây rồi gọi API → `401 TOKEN_EXPIRED`. Sau đó đổi lại `15m`.

Có thể mở DevTools → Network để quan sát Request Headers, Request Payload và Response của từng lần gọi. JWT được trả từ login ở trường `accessToken`; bảng phản hồi trên giao diện ẩn giá trị này và cho xem ở mục JWT riêng.

## 5. API

| Method | Endpoint | Quyền | Kết quả chính |
| --- | --- | --- | --- |
| GET | `/api/health` | Công khai | Server hoạt động |
| POST | `/api/auth/login` | Công khai | JWT và thông tin tài khoản |
| GET | `/api/me` | user, admin | Hồ sơ người gọi |
| GET | `/api/courses` | user, admin | Danh sách học phần |
| GET | `/api/admin/users` | admin | Danh sách tài khoản, không có hash |
| POST | `/api/admin/courses` | admin | Tạo học phần |

Body đăng nhập:

```json
{ "email": "user@example.com", "password": "User@123456" }
```

Body thêm học phần:

```json
{ "code": "WEB401", "title": "Phát triển ứng dụng Web", "description": "Thực hành REST API", "credits": 3 }
```

Các API được bảo vệ yêu cầu header:

```http
Authorization: Bearer <accessToken trả về từ login>
```

Ví dụ thử trong PowerShell khi server đang chạy:

```powershell
$loginBody = @{ email = 'user@example.com'; password = 'User@123456' } | ConvertTo-Json
$loginResult = Invoke-RestMethod 'http://127.0.0.1:3000/api/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody
$authHeaders = @{ Authorization = "Bearer $($loginResult.accessToken)" }
Invoke-RestMethod 'http://127.0.0.1:3000/api/courses' -Headers $authHeaders
# Lệnh sau sẽ báo lỗi HTTP 403 vì tài khoản đang là user:
Invoke-RestMethod 'http://127.0.0.1:3000/api/admin/users' -Headers $authHeaders
```

## 6. Kiểm thử tự động

```sh
npm test
```

Kiểm thử dùng HTTP thật với server mở cổng ngẫu nhiên, không ảnh hưởng server bạn đang demo. Bao gồm đăng nhập, JWT hợp lệ/thiếu/sai/hết hạn/bị sửa, chặn thuật toán khác và `alg:none`, issuer/audience sai, user bị cấm chức năng admin, admin tạo học phần, validate dữ liệu, JSON lỗi và giới hạn đăng nhập.

## 7. Cấu trúc mã nguồn

```text
jwt-web-assignment/
├── public/
│   ├── index.html           Giao diện tiếng Việt
│   ├── styles.css           Giao diện responsive
│   └── app.js               Login, lưu JWT trong RAM, gọi API
├── src/
│   ├── server.js            Đọc cấu hình và chạy server
│   ├── app.js               Các route API và validate dữ liệu
│   ├── data.js              Tài khoản mẫu, hash và học phần
│   └── middleware/auth.js   Xác thực JWT và phân quyền
├── scripts/setup.js        Tạo khóa JWT ngẫu nhiên
├── test/auth.test.js       Kiểm thử tích hợp HTTP
├── .env.example            Mẫu cấu hình (không chứa khóa thật)
├── .gitignore
├── package.json
├── package-lock.json       Khóa phiên bản thư viện
└── README.md
```

## 8. Phạm vi và các quyết định kỹ thuật

- Đây là bài thực hành độc lập; do chưa có mã bài tập nhóm/cá nhân gốc nên ứng dụng cung cấp một nền tảng mẫu mới. Nếu giảng viên bắt buộc dùng dự án cũ, chuyển phần route, middleware và client gửi JWT vào dự án đó.
- Tài khoản và học phần lưu **trong RAM**. Học phần mới tồn tại giữa các lần đăng nhập nhưng mất khi server khởi động lại. Bài không yêu cầu cơ sở dữ liệu; có thể thay store bằng MySQL/PostgreSQL sau.
- Mật khẩu tài khoản mẫu được công bố phục vụ demo; password hash được tạo bằng bcrypt khi khởi động. Không dùng các tài khoản mẫu cho dịch vụ thật.
- JWT có hạn mặc định 15 phút. Khóa HS256 được tạo ngẫu nhiên trên từng máy, không gửi xuống client và không có trong ZIP. `.env` và `node_modules` đã được loại khỏi Git.
- Client giữ JWT trong bộ nhớ JavaScript: refresh cần đăng nhập lại. Đăng xuất xóa token ở client; token đã bị sao chép vẫn có thể dùng đến hết hạn. Bài chưa có refresh token, blacklist hoặc thu hồi token ở server.
- Ẩn khu vực admin trên giao diện chỉ phục vụ trải nghiệm; **middleware server mới thực sự kiểm soát quyền**, kể cả khi gọi API bằng công cụ bên ngoài.
- Hiển thị dữ liệu bằng `textContent`, có CSP, giới hạn JSON 10 KB, không cache phản hồi API và giới hạn 30 yêu cầu đăng nhập/IP/15 phút. Nếu thử quá số lần này, đợi hết cửa sổ giới hạn hoặc khởi động lại server demo.
- Khi triển khai thực tế cần HTTPS, kho dữ liệu bền vững, quản lý tài khoản và chính sách thu hồi phiên phù hợp. ZIP này tập trung yêu cầu thực hành JWT user/admin.

## 9. Chuẩn bị nộp

Bạn tự tạo repository GitHub và quay video theo yêu cầu môn học. Trước khi đẩy code, không thêm `.env` hoặc `node_modules`. Có thể sửa tên ứng dụng và thông tin sinh viên theo bài của bạn. Đọc kỹ phần luồng xác thực và chạy thử từng tình huống để giải thích được cách hoạt động.

Tài liệu chính thức tham khảo: [Express](https://expressjs.com/en/5x/api.html), [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken), [bcryptjs](https://github.com/dcodeIO/bcrypt.js).
