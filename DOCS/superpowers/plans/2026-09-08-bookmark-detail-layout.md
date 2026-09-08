# 书签详情栏布局调整实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 调整书签详情抽屉的信息层级，将录入理由置于书籍属性下方，并将笔记改为默认折叠的底部标签。

**Architecture:** 仅修改详情抽屉展示组件 `detail-drawer.ts`。复用现有内联编辑逻辑，为笔记块增加局部折叠状态；录入理由保持可见并位于“书籍属性”之后。无需修改数据库、API、类型或全局样式。

**Tech Stack:** TypeScript、项目现有 `h` DOM 工具、Tailwind utility class、现有 API 与 toast/refresh 流程。

---

### Task 1: 调整详情抽屉展示结构

**Files:**
- Modify: `src/web/components/detail-drawer.ts:44-118,156-205`

- [ ] **Step 1: 修改可编辑内容块的布局参数**

将 `editableMemoBlock` 增加可选折叠参数，使笔记支持默认收起；录入理由继续使用当前展开视图。折叠态只展示紧凑的“笔记”标签，点击标签切换到完整视图，完整视图继续复用现有编辑、保存、取消逻辑。

- [ ] **Step 2: 调整 `displayBody` 内容顺序**

保留书籍属性容器和标签展示，将 `editableMemoBlock(current, 'reason', '录入理由', 1000)` 放在“书籍属性”及标签之后；移除“我的记录”文字与两侧分割线；将笔记折叠块放在录入理由之后。

- [ ] **Step 3: 检查 DOM 状态切换逻辑**

确认笔记点击展开后可以编辑，取消或保存后恢复可见视图；详情抽屉重新渲染后笔记回到默认折叠状态；录入理由的编辑行为不受影响。

### Task 2: 运行静态检查与构建验证

**Files:**
- Inspect: `package.json`

- [ ] **Step 1: 确认项目提供的验证脚本**

读取 `package.json` 的 scripts，使用仓库已有的 lint、typecheck、test 或 build 命令，不引入新的验证依赖。

- [ ] **Step 2: 运行 lint 与类型检查**

执行项目已有的 lint 和 typecheck 命令；若项目未提供对应脚本，则执行可用的构建检查并明确记录未提供的检查项。

- [ ] **Step 3: 运行测试或构建**

执行项目已有的 test 或 build 命令，确认详情抽屉改动没有造成编译或打包错误。

### Task 3: 补充修改日志并完成收尾

**Files:**
- Modify: `META/LOG/2026-09-08-详情抽屉布局调整.md`

- [ ] **Step 1: 记录本次变更**

按仓库日志格式记录版本、变更文件、验证命令、验证结果和剩余风险；不记录不存在的测试结果。

- [ ] **Step 2: 查看最终差异与状态**

确认差异仅包含本次需求相关的组件、计划/日志文件，避免提交密钥、环境文件、缓存或无关改动。

- [ ] **Step 3: 完成修改后的提交**

使用中文 Conventional Commits 风格提交本次实现，提交前再次确认工作区状态。
