import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (!existsSync(envPath)) {
  writeFileSync(envPath, `PORT=3000\nHOST=127.0.0.1\nJWT_SECRET=${randomBytes(48).toString('hex')}\nJWT_EXPIRES_IN=15m\n`, { flag: 'wx', mode: 0o600 });
  console.log('Đã tạo .env và khóa JWT ngẫu nhiên cho máy của bạn.');
}
