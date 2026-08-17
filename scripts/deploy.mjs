// 部署入口：读取 .wrangler-ids.env 中的真实资源 ID，注入临时 wrangler.prod.toml 后迁移+部署。
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const CONFIG = '.wrangler-ids.env';

function readIds() {
  const out = {};
  if (!existsSync(CONFIG)) return out;
  for (const line of readFileSync(CONFIG, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && !m[2].trim().startsWith('#') && m[2].trim() !== '') out[m[1]] = m[2].trim();
  }
  return out;
}

const ids = readIds();
if (!ids.D1_DATABASE_ID || !ids.KV_NAMESPACE_ID) {
  console.error('[deploy] 缺少配置：请先运行以下命令并把 ID 填入 .wrangler-ids.env');
  console.error('  npx wrangler d1 create bookshelf');
  console.error('  npx wrangler kv namespace create bookshelf-kv');
  console.error('  npx wrangler r2 bucket create bookshelf-covers');
  process.exit(1);
}

const toml = readFileSync('wrangler.toml', 'utf8')
  .replace(/01234567-89ab-cdef-0123-456789abcdef/, ids.D1_DATABASE_ID)
  .replace(/0123456789abcdef0123456789abcdef/, ids.KV_NAMESPACE_ID);
writeFileSync('wrangler.prod.toml', toml);

try {
  console.log('[deploy] 远程迁移…');
  execSync('npx wrangler d1 migrations apply DB --remote --config wrangler.prod.toml', { stdio: 'inherit' });
  console.log('[deploy] 部署…');
  execSync('npx wrangler deploy --config wrangler.prod.toml', { stdio: 'inherit' });
  console.log('[deploy] 完成。');
} finally {
  try {
    rmSync('wrangler.prod.toml', { force: true });
  } catch {
    // 清理临时文件失败不影响部署结果（wrangler.prod.toml 已 gitignore）
  }
}
