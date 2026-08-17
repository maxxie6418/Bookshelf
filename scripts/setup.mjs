// 一键部署编排（Node 运行，不进入 Worker 类型检查）。
// 前置：已 `npx wrangler login`（或设置 CF_API_TOKEN），且 Node 18+。
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const env = (k, fallback) => process.env[k] ?? fallback;

async function main() {
  const initialPassword = env('INITIAL_ADMIN_PASSWORD') || randomBytes(12).toString('hex');
  console.log('[setup] 初始管理员口令（请妥善保存，首登需强制修改）：', initialPassword);

  // 1. 创建资源（已存在则忽略报错）
  run('npx wrangler d1 create bookshelf', true);
  run('npx wrangler r2 bucket create bookshelf-covers', true);
  run('npx wrangler kv namespace create bookshelf-kv', true);
  console.log('[setup] 把上面 kv namespace create 输出的 id 填回 wrangler.toml 的 [[kv_namespaces]].id');

  // 2. 跑迁移（本地 D1；远程部署后请用 --remote 再跑一次）
  run('npx wrangler d1 execute bookshelf --local --file=./migrations/0000_init.sql');

  // 3. seed 初始管理员
  const hash = await bcrypt.hash(initialPassword, 10);
  const safeHash = hash.replace(/'/g, "''");
  run(
    `npx wrangler d1 execute bookshelf --local --command="INSERT OR IGNORE INTO users (username, display_name, password_hash, is_admin, must_change_password) VALUES ('admin', 'Admin', '${safeHash}', 1, 1)"`,
  );

  // 4. 提示设置 secrets（密钥不入库）
  console.log('\n[setup] 请手动设置 secrets：');
  console.log('  npx wrangler secret put SESSION_SECRET');
  console.log('  npx wrangler secret put AI_BASE_URL   # M4 用，可选');
  console.log('  npx wrangler secret put AI_API_KEY    # M4 用，必填于 M4');

  // 5. 部署
  console.log('\n[setup] 开始部署...');
  run('npx wrangler deploy');
  console.log('[setup] 完成。本地可用 `npm run dev` 预览。');
}

function run(cmd, ignoreError = false) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    if (!ignoreError) throw e;
    console.warn(`[setup] 忽略失败（资源可能已存在）：${cmd}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
