# Tasks

- [x] Task 1: 建立统一视觉系统（CSS 变量、字体、阴影、纹理）
  - [x] SubTask 1.1: 在 `src/web/style.css` 中定义 `:root` 与 `.dark` CSS 变量（背景、表面、文字、边框、强调色、阴影、圆角）。
  - [x] SubTask 1.2: 更新 `src/web/index.html` 字体 CDN，引入霞鹜文楷（LXGW WenKai）与等宽数字字体。
  - [x] SubTask 1.3: 在 `tailwind.config.js` 中映射新的字体族（sans / serif / mono / display）。
  - [x] SubTask 1.4: 添加全局纸张纹理与柔和阴影工具类。

- [x] Task 2: 用 SVG 图标替换全站 emoji
  - [x] SubTask 2.1: 在 `src/web/ui.ts` 中新增/复用统一 SVG 图标辅助函数（theme / settings / logout / trash / search / plus / edit / close / empty 等）。
  - [x] SubTask 2.2: 替换 `app-shell.ts` 中的 emoji（☀️🌙⚙️🗑）为 SVG 图标。
  - [x] SubTask 2.3: 检查并替换 `book-form.ts`、`detail-drawer.ts`、`login.ts`、`trash-panel.ts`、`settings-panel.ts` 中的 emoji 图标。

- [x] Task 3: 重新设计书籍封面占位图
  - [x] SubTask 3.1: 移除 `style.css` 中的 `cover-pattern-1 ~ cover-pattern-12` 渐变类。
  - [x] SubTask 3.2: 在 `src/web/ui.ts` 中实现基于书名哈希的低饱和抽象封面生成器（背景色 + 装饰线/腰封 + 标题文字）。
  - [x] SubTask 3.3: 更新 `book-list.ts` 的 grid/table 封面渲染调用新生成器。

- [x] Task 4: 重构顶栏与侧边栏布局
  - [x] SubTask 4.1: 简化 `app-shell.ts` 顶栏：搜索框居中放大、按钮图标化、去掉大面积色块。
  - [x] SubTask 4.2: 调整侧边栏为「索引目录」风格：小字号、宽松行高、当前项使用左侧强调线或浅色背景。
  - [x] SubTask 4.3: 统一统计卡片样式，与新的视觉系统一致。

- [x] Task 5: 打磨网格/表格视图与组件细节
  - [x] SubTask 5.1: 调整 `book-list.ts` 网格卡片阴影、hover 幅度、行间距，加入书架分隔感。
  - [x] SubTask 5.2: 调整表格视图内边距、边框、hover 背景，减少视觉噪音。
  - [x] SubTask 5.3: 统一状态徽标、分类标签、评分星星、按钮样式。
  - [x] SubTask 5.4: 统一按钮（primary/ghost/icon）的 default / hover / active / disabled 状态。

- [x] Task 6: 优化动效与过渡
  - [x] SubTask 6.1: 缩短列表入场动画时长并保留错落延迟。
  - [x] SubTask 6.2: 为抽屉/弹窗加入更自然的缓动曲线。
  - [x] SubTask 6.3: 确保主题切换时颜色与阴影平滑过渡。

- [x] Task 7: 改进空态与加载态
  - [x] SubTask 7.1: 在 `book-list.ts` 中实现骨架屏或精致加载指示器。
  - [x] SubTask 7.2: 重新设计空态：插画/图标 + 文案 + 添加书籍操作。

- [x] Task 8: 验证与收尾
  - [x] SubTask 8.1: 运行本地开发服务器，验证 light/dark 模式、网格/表格视图、空态、加载态、抽屉、表单。
  - [x] SubTask 8.2: 检查移动端响应式布局无错位。
  - [x] SubTask 8.3: 在 `META/LOG/` 记录本次修改摘要。

# Task Dependencies

- Task 2 depends on Task 1（图标颜色/字体依赖视觉系统）
- Task 3 depends on Task 1（封面配色依赖新调色板）
- Task 4 depends on Task 2（顶栏/侧边栏需使用新 SVG 图标）
- Task 5 depends on Task 1 和 Task 3（视图组件使用新封面与变量）
- Task 6 depends on Task 4 和 Task 5
- Task 7 depends on Task 5
- Task 8 depends on Task 6 和 Task 7
