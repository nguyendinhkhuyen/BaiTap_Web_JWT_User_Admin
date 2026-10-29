import bcrypt from 'bcryptjs';

// Tài khoản cố định dành riêng cho bài thực hành. Chỉ giữ hash trong kho dữ liệu.
export function createStore() {
  return {
    users: [
      { id: 'u01', name: 'Nguyễn Minh Anh', email: 'user@example.com', role: 'user', passwordHash: bcrypt.hashSync('User@123456', 10) },
      { id: 'a01', name: 'Quản trị viên', email: 'admin@example.com', role: 'admin', passwordHash: bcrypt.hashSync('Admin@123456', 10) }
    ],
    courses: [
      { id: 1, code: 'WEB301', title: 'Công nghệ lập trình Web', description: 'Xây dựng ứng dụng web, REST API và xác thực người dùng.', credits: 3 },
      { id: 2, code: 'DB201', title: 'Cơ sở dữ liệu', description: 'Mô hình dữ liệu quan hệ, SQL và thiết kế cơ sở dữ liệu.', credits: 3 },
      { id: 3, code: 'SE302', title: 'Công nghệ phần mềm', description: 'Phân tích yêu cầu, thiết kế và kiểm thử phần mềm.', credits: 3 }
    ],
    nextCourseId: 4
  };
}

export const publicUser = ({ id, name, email, role }) => ({ id, name, email, role });
