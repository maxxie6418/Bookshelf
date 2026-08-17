import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const initialPassword = process.env.INITIAL_ADMIN_PASSWORD || randomBytes(12).toString('hex');
console.log('[seed-local] 初始管理员口令（请保存）：', initialPassword);

const hash = await bcrypt.hash(initialPassword, 10);
const safeHash = hash.replace(/'/g, "''");

execSync('npx wrangler d1 execute bookshelf --local --file=./migrations/0000_init.sql', { stdio: 'inherit' });

const tmpDir = mkdtempSync(join(tmpdir(), 'bs-seed-'));
const sqlFile = join(tmpDir, 'insert.sql');
writeFileSync(sqlFile, `INSERT OR IGNORE INTO users (username, display_name, password_hash, is_admin, must_change_password) VALUES ('admin', 'Admin', '${safeHash}', 1, 1);\n`);
try {
  execSync(`npx wrangler d1 execute bookshelf --local --file="${sqlFile}"`, { stdio: 'inherit' });
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log('[seed-local] 完成。');
