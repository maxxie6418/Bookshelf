// 部署入口：Wrangler 4.45+ 自动资源创建（D1/R2/KV 配置中不写 ID，deploy 时自动创建或按名字复用已存在资源）。
// 流程：备份配置 → wrangler deploy（JSONC 配置支持 ID 回写）→ 远程迁移 → 恢复配置（仓库保持不含账号私有 ID）。
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const CONFIG = 'wrangler.jsonc';
const D1_NAME = 'bookshelf';

function main() {
  const backup = readFileSync(CONFIG, 'utf8');
  try {
    console.log('[deploy] 构建前端（vite build）…');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('[deploy] 部署 Worker（自动创建或复用 D1/R2/KV 资源）…');
    execSync('npx wrangler deploy', { stdio: 'inherit' });
    console.log(`[deploy] 应用远程数据库迁移（${D1_NAME}）…`);
    execSync(`npx wrangler d1 migrations apply ${D1_NAME} --remote`, { stdio: 'inherit' });
    console.log('[deploy] 完成。');
  } catch (e) {
    console.error('[deploy] 部署失败，请检查上面的错误信息。');
    process.exitCode = 1;
  } finally {
    writeFileSync(CONFIG, backup);
  }
}

main();