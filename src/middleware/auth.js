import jwt from 'jsonwebtoken';

export const ISSUER = 'campus-jwt-server';
export const AUDIENCE = 'campus-web-client';

// Xác thực trước, phân quyền sau. Không tin role do client tự gửi.
export function authenticate(secret, store) {
  return (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');
    if (!match) return res.status(401).json({ authorized: false, code: 'TOKEN_MISSING', message: 'Thiếu JWT. Hãy gửi Authorization: Bearer <token>.' });
    try {
      const payload = jwt.verify(match[1], secret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
      const user = store.users.find(item => item.id === payload.sub);
      if (!user || user.role !== payload.role) {
        return res.status(401).json({ authorized: false, code: 'TOKEN_INVALID', message: 'Tài khoản hoặc vai trò không còn hợp lệ.' });
      }
      req.user = user;
      next();
    } catch (error) {
      const expired = error.name === 'TokenExpiredError';
      return res.status(401).json({ authorized: false, code: expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID', message: expired ? 'JWT đã hết hạn. Vui lòng đăng nhập lại.' : 'JWT không hợp lệ hoặc đã bị chỉnh sửa.' });
    }
  };
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ authorized: false, code: 'FORBIDDEN', message: 'Bạn đã đăng nhập nhưng không có quyền truy cập chức năng này.', requiredRoles: roles, currentRole: req.user.role });
    }
    next();
  };
}
