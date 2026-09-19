import { defineConfig, type Plugin } from 'vite';

// 剔除字体 @font-face 里的 .woff 回退产物与引用：
// @fontsource 的 CSS 同时列出 woff2 + woff，浏览器永远只下载排在前面的 woff2，
// .woff 文件只重复占用部署体积（Workers Assets 每次部署都上传存储）。
// 此插件在产物生成阶段删掉 .woff 资源并同步清掉 CSS 里的 woff 引用。
function dropWoffFallbacks(): Plugin {
  return {
    name: 'drop-woff-fallbacks',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const file = bundle[fileName];
        if (fileName.endsWith('.woff')) {
          delete bundle[fileName];
        } else if (fileName.endsWith('.css') && file.type === 'asset') {
          file.source = String(file.source).replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
        }
      }
    },
  };
}

// SPA 构建到 dist/，由 Cloudflare Worker 的 Workers Assets 托管。
export default defineConfig({
  root: 'src/web',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  plugins: [dropWoffFallbacks()],
  server: {
    port: 5173,
  },
});
