import express from 'express';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'node:url';
import { createStore, publicUser } from './data.js';
import { authenticate, authorize, ISSUER, AUDIENCE } from './middleware/auth.js';

export function createApp({ secret, expiresIn = '15m', loginLimit = 30 } = {}) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('JWT_SECRET phải có ít nhất 32 ký tự. Chạy npm run setup.');
  const app = express();
  const store = createStore();
  const auth = authenticate(secret, store);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    });
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '10kb' }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.post('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000, limit: loginLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { authorized: false, code: 'TOO_MANY_ATTEMPTS', message: 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút.' }
  }), async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 72 || !email.trim() || !password) {
      return res.status(400).json({ authorized: false, code: 'VALIDATION_ERROR', message: 'Vui lòng nhập email và mật khẩu hợp lệ (mật khẩu tối đa 72 ký tự).' });
    }
    const user = store.users.find(item => item.email === email.trim().toLowerCase());
    // So sánh cả khi email không tồn tại để tránh trả về quá nhanh.
    const valid = await bcrypt.compare(password, (user || store.users[0]).passwordHash);
    if (!user || !valid) return res.status(401).json({ authorized: false, code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' });
    const accessToken = jwt.sign({ role: user.role }, secret, { algorithm: 'HS256', subject: user.id, issuer: ISSUER, audience: AUDIENCE, expiresIn });
    const { exp } = jwt.decode(accessToken);
    res.json({ authorized: true, message: 'Đăng nhập thành công.', accessToken, tokenType: 'Bearer', expiresAt: exp, user: publicUser(user) });
  });

  app.get('/api/me', auth, (req, res) => res.json({ authorized: true, message: 'JWT hợp lệ.', user: publicUser(req.user) }));
  app.get('/api/courses', auth, authorize('user', 'admin'), (req, res) => res.json({ authorized: true, message: 'Được phép xem học phần.', courses: store.courses }));
  app.get('/api/admin/users', auth, authorize('admin'), (req, res) => res.json({ authorized: true, message: 'Được phép xem danh sách tài khoản.', users: store.users.map(publicUser) }));
  app.post('/api/admin/courses', auth, authorize('admin'), (req, res) => {
    const { code, title, description = '', credits } = req.body || {};
    if (typeof code !== 'string' || !/^[A-Za-z0-9-]{2,12}$/.test(code) || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100 || typeof description !== 'string' || description.length > 300 || !Number.isInteger(credits) || credits < 1 || credits > 10) {
      return res.status(400).json({ authorized: true, code: 'VALIDATION_ERROR', message: 'Mã: 2–12 ký tự chữ/số/gạch ngang; tên: 3–100 ký tự; mô tả: tối đa 300 ký tự; tín chỉ: số nguyên 1–10.' });
    }
    if (store.courses.some(course => course.code === code.toUpperCase())) return res.status(409).json({ authorized: true, code: 'DUPLICATE_COURSE', message: 'Mã học phần đã tồn tại.' });
    const course = { id: store.nextCourseId++, code: code.toUpperCase(), title: title.trim(), description: description.trim(), credits };
    store.courses.push(course);
    res.status(201).json({ authorized: true, message: 'Đã thêm học phần.', course });
  });
  app.use('/api', (req, res) => res.status(404).json({ message: 'API không tồn tại.', code: 'NOT_FOUND' }));
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ code: 'INVALID_JSON', message: 'Nội dung JSON không hợp lệ.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ code: 'BODY_TOO_LARGE', message: 'Yêu cầu vượt quá dung lượng cho phép.' });
    console.error('Server error:', error.message);
    res.status(500).json({ code: 'SERVER_ERROR', message: 'Server gặp lỗi xử lý.' });
  });
  return app;
}
