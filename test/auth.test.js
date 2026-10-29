import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { ISSUER, AUDIENCE } from '../src/middleware/auth.js';

const secret = 'test-only-secret-at-least-32-characters-long';
let server, base, userToken, adminToken;
const sign = (payload = { role: 'user' }, options = {}) => jwt.sign(payload, secret, {
  algorithm: 'HS256', subject: 'u01', issuer: ISSUER, audience: AUDIENCE, expiresIn: '15m', ...options
});
async function request(path, { token, body, method = 'GET', raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined || raw !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  return { status: response.status, headers: response.headers, data: await response.json() };
}
before(async () => {
  server = createApp({ secret }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  userToken = (await request('/api/auth/login', { method: 'POST', body: { email: 'user@example.com', password: 'User@123456' } })).data.accessToken;
  adminToken = (await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'Admin@123456' } })).data.accessToken;
});
after(() => new Promise(resolve => server.close(resolve)));

test('Đăng nhập cấp JWT được ký, có sub/role/exp và không lộ hash', async () => {
  const r = await request('/api/auth/login', { method: 'POST', body: { email: 'USER@example.com', password: 'User@123456', role: 'admin' } });
  assert.equal(r.status, 200);
  const payload = jwt.verify(r.data.accessToken, secret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
  assert.equal(payload.role, 'user');
  assert.equal(payload.sub, 'u01');
  assert.equal(payload.exp - payload.iat, 900);
  assert.equal(r.data.user.passwordHash, undefined);
});
test('Sai mật khẩu hoặc email không tồn tại đều trả 401', async () => {
  for (const email of ['user@example.com', 'missing@example.com']) {
    const r = await request('/api/auth/login', { method: 'POST', body: { email, password: 'wrong' } });
    assert.equal(r.status, 401);
    assert.equal(r.data.code, 'INVALID_CREDENTIALS');
  }
});
test('Thiếu dữ liệu đăng nhập trả 400', async () => {
  const r = await request('/api/auth/login', { method: 'POST', body: {} });
  assert.equal(r.status, 400);
});
test('Thiếu JWT trả 401', async () => {
  const r = await request('/api/me');
  assert.equal(r.status, 401);
  assert.equal(r.data.authorized, false);
});
test('Token rác trả 401', async () => {
  assert.equal((await request('/api/me', { token: 'not-a-token' })).status, 401);
});
test('User truy cập hồ sơ và học phần thành công', async () => {
  const profile = await request('/api/me', { token: userToken });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.user.role, 'user');
  const courses = await request('/api/courses', { token: userToken });
  assert.equal(courses.status, 200);
  assert.ok(courses.data.courses.length >= 3);
});
test('User không thể đọc danh sách tài khoản admin', async () => {
  const r = await request('/api/admin/users', { token: userToken });
  assert.equal(r.status, 403);
  assert.equal(r.data.code, 'FORBIDDEN');
});
test('Admin đọc tài khoản, không lộ mật khẩu hoặc hash', async () => {
  const r = await request('/api/admin/users', { token: adminToken });
  assert.equal(r.status, 200);
  assert.equal(r.data.users.length, 2);
  for (const user of r.data.users) {
    assert.equal(user.passwordHash, undefined);
    assert.equal(user.password, undefined);
  }
});
test('User không thể tạo học phần kể cả tự gửi role admin', async () => {
  const r = await request('/api/admin/courses', { method: 'POST', token: userToken, body: { code: 'HACK01', title: 'Unauthorized', credits: 3, role: 'admin' } });
  assert.equal(r.status, 403);
  const list = await request('/api/courses', { token: userToken });
  assert.equal(list.data.courses.some(c => c.code === 'HACK01'), false);
});
test('Admin tạo học phần và user đọc được dữ liệu vừa tạo', async () => {
  const r = await request('/api/admin/courses', { method: 'POST', token: adminToken, body: { code: 'TEST01', title: 'Học phần kiểm thử', credits: 2 } });
  assert.equal(r.status, 201);
  const list = await request('/api/courses', { token: userToken });
  assert.ok(list.data.courses.some(c => c.code === 'TEST01'));
  const duplicate = await request('/api/admin/courses', { method: 'POST', token: adminToken, body: { code: 'test01', title: 'Học phần kiểm thử', credits: 2 } });
  assert.equal(duplicate.status, 409);
});
test('Admin gửi dữ liệu học phần sai trả 400', async () => {
  assert.equal((await request('/api/admin/courses', { method: 'POST', token: adminToken, body: { code: 'X', title: 'A', credits: -1 } })).status, 400);
});
test('Sửa payload role nhưng giữ chữ ký bị từ chối', async () => {
  const parts = userToken.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  payload.role = 'admin';
  parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const r = await request('/api/admin/users', { token: parts.join('.') });
  assert.equal(r.status, 401);
  assert.equal(r.data.code, 'TOKEN_INVALID');
});
test('JWT hết hạn trả TOKEN_EXPIRED', async () => {
  const r = await request('/api/me', { token: sign({ role: 'user' }, { expiresIn: -1 }) });
  assert.equal(r.status, 401);
  assert.equal(r.data.code, 'TOKEN_EXPIRED');
});
test('Chặn sai audience, issuer, thuật toán, chữ ký và tài khoản', async () => {
  const tokens = [
    sign({ role: 'user' }, { audience: 'wrong' }),
    sign({ role: 'user' }, { issuer: 'wrong' }),
    sign({ role: 'user' }, { algorithm: 'HS384' }),
    sign({ role: 'user' }, { subject: 'deleted-user' }),
    sign({ role: 'admin' }),
    jwt.sign({ role: 'user' }, 'another-secret-at-least-32-characters', { subject: 'u01', issuer: ISSUER, audience: AUDIENCE, expiresIn: '15m' }),
    `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from('{"sub":"u01","role":"admin"}').toString('base64url')}.`
  ];
  for (const token of tokens) assert.equal((await request('/api/me', { token })).status, 401);
});
test('JSON hỏng trả 400 và phản hồi API không được cache', async () => {
  const r = await request('/api/auth/login', { method: 'POST', raw: '{broken' });
  assert.equal(r.status, 400);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});
test('Giới hạn số lần đăng nhập trả 429', async () => {
  const limited = createApp({ secret, loginLimit: 1 }).listen(0, '127.0.0.1');
  await once(limited, 'listening');
  try {
    const url = `http://127.0.0.1:${limited.address().port}/api/auth/login`;
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };
    assert.equal((await fetch(url, options)).status, 400);
    assert.equal((await fetch(url, options)).status, 429);
  } finally { await new Promise(resolve => limited.close(resolve)); }
});
test('Server phục vụ giao diện web', async () => {
  const r = await fetch(base);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Campus Portal/);
});
