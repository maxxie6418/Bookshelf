// 一键部署编排（Node 运行，不进入 Worker 类型检查）。
// 与 npm run deploy 相同：构建 → 部署（Wrangler 4.45+ 自动创建/复用 D1/R2/KV）→ 远程迁移。
// 另生成初始管理员口令提示；初始管理员由 Worker 首次请求时自动 seed。
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const CONFIG = 'wrangler.jsonc';
const D1_NAME = 'bookshelf';
const env = (k, fallback) => process.env[k] ?? fallback;

async function main() {
  const initialPassword = env('INITIAL_ADMIN_PASSWORD') || randomBytes(12).toString('hex');
  console.log('[setup] 初始管理员口令（请妥善保存，首登需强制修改）：', initialPassword);

  const backup = readFileSync(CONFIG, 'utf8');
  try {
    console.log('[setup] 构建前端（vite build）…');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('[setup] 部署 Worker（自动创建或复用 D1/R2/KV 资源）…');
    execSync('npx wrangler deploy', { stdio: 'inherit' });
    console.log(`[setup] 应用远程数据库迁移（${D1_NAME}）…`);
    execSync(`npx wrangler d1 migrations apply ${D1_NAME} --remote`, { stdio: 'inherit' });
    console.log('[setup] 完成。');
  } catch (e) {
    console.error('[setup] 部署失败，请检查上面的错误信息。');
    process.exitCode = 1;
  } finally {
    writeFileSync(CONFIG, backup);
  }

  console.log('\n[setup] secrets 设置（密钥不入库）：');
  console.log('  npx wrangler secret put SESSION_SECRET       # 必填');
  console.log('  npx wrangler secret put AI_BASE_URL          # M4 用，可选');
  console.log('  npx wrangler secret put AI_API_KEY           # M4 用，必填于 M4');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});