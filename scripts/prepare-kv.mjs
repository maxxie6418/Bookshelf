// KV 同名复用：绕开 wrangler 已知 bug（workers-sdk#14284，#14286 未发布）——
// auto-provisioning 创建 KV 时不做查重，账号里已有同名 namespace 会报 10014。
// 本脚本在构建/部署前运行：查到同名 KV 则把其 ID 注入 wrangler.jsonc 复用；
// 查不到则不改配置，由 wrangler 首次部署时自动创建，后续部署再查即可复用。
// 本地只构建不部署时若 wrangler.jsonc 被注入 ID 属正常行为，请勿提交该改动（git checkout -- wrangler.jsonc）。
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const CONFIG = 'wrangler.jsonc';
const KV_BINDING = 'KV';
const KV_TITLE = 'bookshelf-kv';

function main() {
  let namespaces = [];
  const mock = process.env.KV_LIST_JSON;
  if (mock) {
    try {
      namespaces = JSON.parse(mock);
    } catch (e) {
      console.warn('[prepare-kv] KV_LIST_JSON 解析失败，忽略模拟列表');
    }
  } else {
    try {
      const out = execSync('npx wrangler kv namespace list --json', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      namespaces = JSON.parse(out);
    } catch (e) {
      console.warn('[prepare-kv] 无法查询 KV 列表（可能未登录 Cloudflare），跳过复用，交由 wrangler 自动创建');
      return;
    }
  }

  const desired = process.env.BOOKSHELF_KV_ID;
  const hit = (namespaces ?? []).find(
    (n) =>
      n?.id === desired ||
      (typeof n?.title === 'string' && n.title.toLowerCase() === KV_TITLE.toLowerCase()),
  );
  if (!hit) {
    const src = readFileSync(CONFIG, 'utf8');
    const next = src.replace(
      new RegExp(`("binding": "${KV_BINDING}",)(\\s*\\n\\s*"id": "[^"]+",?\\s*\\n)`),
      `"binding": "${KV_BINDING}"\n`,
    );
    if (next !== src) {
      writeFileSync(CONFIG, next);
      console.log('[prepare-kv] 未发现同名 KV，已移除配置中失效的旧 ID，交由 wrangler 自动创建');
      return;
    }
    console.log(`[prepare-kv] 未发现同名 KV（${KV_TITLE}），将交由 wrangler 自动创建`);
    return;
  }

  const src = readFileSync(CONFIG, 'utf8');
  if (src.includes(`"${hit.id}"`)) {
    console.log(`[prepare-kv] 已复用同名 KV ${hit.title}（${hit.id}）`);
    return;
  }
  const marker = `"binding": "${KV_BINDING}"`;
  const inject = `"binding": "${KV_BINDING}",\n      "id": "${hit.id}"`;
  const next = src.replace(marker, inject);
  if (next === src) {
    console.warn('[prepare-kv] 未在配置中找到 KV binding，跳过注入');
    return;
  }
  writeFileSync(CONFIG, next);
  console.log(`[prepare-kv] 已注入并复用同名 KV ${hit.title}（${hit.id}）`);
}

main();