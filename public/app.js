const $ = selector => document.querySelector(selector);
let accessToken = ''; // Chỉ lưu trong RAM; không ghi localStorage hoặc cookie.
let currentUser = null;

function message(selector, text, success = false) {
  const element = $(selector);
  element.textContent = text;
  element.className = `message ${success ? 'success' : 'error'}`;
}

function decodePayload(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

function renderSession() {
  const signedIn = Boolean(currentUser);
  $('#login-area').hidden = signedIn;
  $('#profile-area').hidden = !signedIn;
  $('#admin-panel').hidden = currentUser?.role !== 'admin';
  $('#admin-nav').hidden = currentUser?.role !== 'admin';
  $('#greeting').textContent = signedIn ? `${currentUser.name}.` : 'bạn học.';
  $('#session-badge').textContent = signedIn ? `Đã đăng nhập · ${currentUser.role}` : 'Chưa đăng nhập';
  $('#session-badge').className = signedIn ? 'badge' : 'badge neutral';
  if (signedIn) {
    $('#profile-name').textContent = currentUser.name;
    $('#profile-email').textContent = currentUser.email;
    $('#profile-role').textContent = `Vai trò: ${currentUser.role}`;
    $('#profile-avatar').textContent = currentUser.role === 'admin' ? 'A' : 'U';
  }
  $('#token-value').value = accessToken;
  $('#payload-view').textContent = accessToken ? JSON.stringify(decodePayload(accessToken), null, 2) : 'Chưa có token.';
  $('#token-expiry').textContent = accessToken ? `Hết hạn: ${new Date(decodePayload(accessToken).exp * 1000).toLocaleString('vi-VN')}` : '';
}

function clearSession() {
  accessToken = '';
  currentUser = null;
  renderSession();
  $('#course-list').replaceChildren();
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = 'Đăng nhập để xem danh sách học phần.';
  $('#course-list').append(p);
  $('#course-message').textContent = '';
  $('#admin-message').textContent = '';
  $('#password').value = '';
}

function displayResponse(method, path, status, data) {
  $('#request-label').textContent = `${method} ${path}`;
  $('#http-status').textContent = `${status} ${status < 300 ? 'OK' : 'ERROR'}`;
  $('#response-body').textContent = JSON.stringify(data, null, 2);
}

// Mọi API được bảo vệ đều gửi JWT qua Authorization header.
async function api(path, { method = 'GET', body, token = accessToken } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    // Token đăng nhập được quan sát riêng trong vùng JWT, tránh lặp lại trong log.
    const view = data.accessToken ? { ...data, accessToken: '(Xem mục Kiểm tra JWT bên dưới)' } : data;
    displayResponse(method, path, response.status, view);
    if (response.status === 401 && token && token === accessToken && path !== '/api/auth/login') {
      clearSession();
      message('#auth-message', 'Phiên không còn hợp lệ. Vui lòng đăng nhập lại.');
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    const data = { message: 'Không kết nối được server. Kiểm tra server đã chạy bằng npm start.' };
    displayResponse(method, path, 0, data);
    return { ok: false, status: 0, data };
  }
}

function renderCourses(courses) {
  $('#course-list').replaceChildren();
  for (const course of courses) {
    const article = document.createElement('article');
    article.className = 'course';
    const icon = document.createElement('span');
    icon.className = 'course-symbol';
    icon.textContent = '▤';
    const content = document.createElement('div');
    const code = document.createElement('small');
    code.textContent = `${course.code} / ${course.credits} TÍN CHỈ`;
    const title = document.createElement('h3');
    title.textContent = course.title;
    const description = document.createElement('p');
    description.textContent = course.description;
    content.append(code, title, description);
    article.append(icon, content);
    $('#course-list').append(article);
  }
}

async function loadCourses() {
  const result = await api('/api/courses');
  if (result.ok) renderCourses(result.data.courses);
  message('#course-message', result.ok ? `Đã tải ${result.data.courses.length} học phần.` : result.data.message, result.ok);
}

document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => {
  const role = button.dataset.demo;
  $('#email').value = `${role}@example.com`;
  $('#password').value = role === 'admin' ? 'Admin@123456' : 'User@123456';
  message('#auth-message', 'Đã điền tài khoản. Nhấn Đăng nhập để gửi yêu cầu.', true);
}));

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('#login-button').disabled = true;
  const result = await api('/api/auth/login', { method: 'POST', token: '', body: { email: $('#email').value, password: $('#password').value } });
  $('#login-button').disabled = false;
  if (!result.ok) return message('#auth-message', result.data.message);
  accessToken = result.data.accessToken;
  currentUser = result.data.user;
  $('#password').value = '';
  renderSession();
  message('#auth-message', 'Đăng nhập thành công. Server đã cấp JWT.', true);
  // Giữ phản hồi đăng nhập trong bảng kiểm tra; user chủ động tải học phần.
} );

$('#logout-button').addEventListener('click', () => {
  clearSession();
  $('#response-body').textContent = '{ "message": "Đã xóa JWT khỏi bộ nhớ của trang." }';
  $('#request-label').textContent = 'Phiên đã kết thúc ở client';
  $('#http-status').textContent = 'READY';
  message('#auth-message', 'Đã đăng xuất.', true);
});
$('#load-courses').addEventListener('click', loadCourses);
document.querySelectorAll('[data-api]').forEach(button => button.addEventListener('click', async () => {
  button.disabled = true;
  const result = await api(button.dataset.api);
  if (result.ok && result.data.courses) renderCourses(result.data.courses);
  button.disabled = false;
}));
$('#test-missing').addEventListener('click', () => api('/api/me', { token: '' }));
$('#test-tampered').addEventListener('click', () => {
  if (!accessToken) {
    displayResponse('GET', '/api/admin/users', 0, { message: 'Hãy đăng nhập trước để có JWT cần chỉnh sửa.' });
    return;
  }
  // Sửa payload nhưng giữ nguyên chữ ký: server phải trả 401 TOKEN_INVALID.
  const parts = accessToken.split('.');
  const payload = decodePayload(accessToken);
  payload.role = payload.role === 'admin' ? 'user' : 'admin';
  parts[1] = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  api('/api/admin/users', { token: parts.join('.') });
});
$('#course-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const result = await api('/api/admin/courses', { method: 'POST', body: {
    code: $('#course-code').value.trim(), title: $('#course-title').value.trim(),
    description: $('#course-description').value.trim(), credits: Number($('#course-credits').value)
  } });
  message('#admin-message', result.data.message, result.ok);
  if (result.ok) {
    $('#course-form').reset();
    // Tải dữ liệu mới nhưng giữ phản hồi POST 201 để thuận tiện quan sát.
    const created = result.data;
    await loadCourses();
    displayResponse('POST', '/api/admin/courses', 201, created);
  }
  button.disabled = false;
});
renderSession();
