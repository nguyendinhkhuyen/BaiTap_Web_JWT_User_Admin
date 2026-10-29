import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const app = createApp({ secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
const server = app.listen(port, host, () => console.log(`Campus Portal đang chạy: http://${host}:${port}\nNhấn Ctrl+C để dừng server.`));
server.on('error', error => { console.error(`Không thể khởi động: ${error.message}`); process.exitCode = 1; });
