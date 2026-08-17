# 前端视觉精细化改造 Spec

## Why

当前网页版沿用了原型稿的默认 Tailwind 组件风格（Inter 字体、emoji 图标、彩虹渐变封面、侧边栏仪表盘布局），整体呈现“可运行原型”的质感，缺少成品应有的统一视觉概念与细节打磨。本次改造目标是在不改动后端与业务逻辑的前提下，通过建立「私人图书馆 · 纸质感编辑风」的视觉系统，让界面在色彩、字体、图标、动效、空态等维度达到更高完成度。

## What Changes

- 建立统一的 CSS 变量视觉系统：暖色调纸张背景、深褐文字、琥珀点缀，支持平滑的 light/dark 主题切换。
- 替换全站 emoji 图标为统一风格 SVG（顶栏、按钮、空态、抽屉）。
- 重新设计书籍封面占位图：从糖果渐变改为基于书名的低饱和抽象书脊/腰封风格。
- 优化字体搭配：中文使用霞鹜文楷/思源宋体降级，数字使用等宽字体，提升阅读温度。
- 重构顶栏与侧边栏：减少色块堆砌，采用更克制的索引目录式导航。
- 打磨组件细节：按钮状态、徽标、评分、输入框的阴影/圆角/过渡统一。
- 优化动效：列表错落入场缩短时长，卡片 hover 更克制，抽屉/弹窗缓动更自然。
- 改进空态与加载态：从纯文字改为带图标/骨架屏的引导状态。

## Impact

- Affected specs: 无前置依赖 spec。
- Affected code:
  - `src/web/style.css`：CSS 变量、字体、阴影、纹理、动画。
  - `src/web/index.html`：字体 CDN 链接。
  - `src/web/components/app-shell.ts`：顶栏、侧边栏、图标、统计卡片。
  - `src/web/components/book-list.ts`：封面占位、网格/表格视图、工具栏、空态、加载态。
  - `src/web/components/detail-drawer.ts`：抽屉图标与样式。
  - `src/web/components/book-form.ts`：表单图标与样式。
  - `src/web/components/login.ts`：登录页图标与样式。
  - `src/web/components/trash-panel.ts`：回收站图标与样式。
  - `src/web/components/settings-panel.ts`：设置面板图标与样式。
  - `src/web/ui.ts`：通用 SVG 图标渲染、星级评分样式。
  - `tailwind.config.js`：字体与颜色扩展（若仍需要）。

## ADDED Requirements

### Requirement: 统一视觉系统

The system SHALL provide a cohesive visual design system rooted in a "personal library / paper editorial" aesthetic.

#### Scenario: Light mode
- **WHEN** the user uses the app in light mode
- **THEN** the background SHALL use a warm paper tone, text SHALL be deep brown, and amber SHALL be the primary accent color.

#### Scenario: Dark mode
- **WHEN** the user switches to dark mode
- **THEN** the background SHALL be a dark charcoal, text SHALL be warm gray, and the accent SHALL remain amber with a subtle glow.

#### Scenario: Theme transition
- **WHEN** the theme toggles
- **THEN** color transitions SHALL be smooth within 300 ms.

### Requirement: SVG 图标替换

The system SHALL replace all emoji icons with a consistent set of SVG icons.

#### Scenario: Top bar actions
- **WHEN** the user views the top bar
- **THEN** theme toggle, settings, and logout SHALL use SVG icons instead of emoji.

#### Scenario: Sidebar actions
- **WHEN** the user views the sidebar
- **THEN** the trash entry SHALL use an SVG icon instead of emoji.

### Requirement: 封面占位图风格

The system SHALL generate book cover placeholders that look like curated book spines or covers rather than generic gradients.

#### Scenario: Missing cover
- **GIVEN** a book has no cover_url
- **WHEN** it is rendered in grid or table
- **THEN** the placeholder SHALL use a desaturated abstract pattern or paper-style block derived from the book title, with the title displayed in a refined type treatment.

### Requirement: 空态与加载态

The system SHALL provide polished empty and loading states.

#### Scenario: Empty bookshelf
- **WHEN** no books match the current filters
- **THEN** the view SHALL show a composed empty state with an illustration/icon, helpful copy, and a clear add-book action.

#### Scenario: Loading list
- **WHEN** the book list is loading
- **THEN** the view SHALL show a skeleton screen or a refined loading indicator instead of plain text.

## MODIFIED Requirements

### Requirement: 顶栏布局

The top bar SHALL remain sticky and include search, theme toggle, add-book button, settings, and logout.

#### Scenario: Desktop top bar
- **WHEN** the viewport is wide
- **THEN** the search bar SHALL be centered and prominent, action buttons SHALL be icon-only or minimal text, and emoji SHALL NOT appear.

#### Scenario: Mobile top bar
- **WHEN** the viewport is narrow
- **THEN** the search bar SHALL move below the main bar, and a floating action button SHALL remain for adding books.

### Requirement: 侧边栏导航

The sidebar SHALL continue to provide status, category, tag filters, and the trash link.

#### Scenario: Active filter
- **WHEN** a filter is active
- **THEN** it SHALL be highlighted with an understated indicator (subtle background or accent line) rather than a full button fill.

### Requirement: 网格与表格视图

The grid and table views SHALL continue to display books with cover, title, author, status, category, and rating.

#### Scenario: Grid view
- **WHEN** books are shown in grid view
- **THEN** cards SHALL use refined shadows, hover lift SHALL be subtle (-2px), and a faint shelf-like separator SHALL appear between rows.

#### Scenario: Table view
- **WHEN** books are shown in table view
- **THEN** rows SHALL use generous padding, minimal borders, and a soft hover background.

## REMOVED Requirements

### Requirement: 彩虹渐变封面占位图

**Reason**: The current `cover-pattern-1 ~ cover-pattern-12` candy gradients look like placeholders and clash with the refined paper aesthetic.
**Migration**: Replace with a deterministic, low-saturation cover generator based on the book title or category.

### Requirement: Emoji 图标

**Reason**: Emoji icons reduce the perceived polish of a finished product and do not align with a unified icon system.
**Migration**: Replace every emoji used as an icon with an equivalent SVG from the new icon set.