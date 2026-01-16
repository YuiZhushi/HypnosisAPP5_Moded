# 催眠APP前端（HypnoOS）

这是一个运行于酒馆助手（Tavern Helper）iframe 环境中的前端界面项目（React + TailwindCSS）。

## 构建/运行口径（以仓库根目录为准）

本项目由仓库根目录的 `webpack.config.ts` 扫描 `src/**/index.{ts,tsx,js,jsx}` 自动发现并打包；请在**仓库根目录**运行：

- 开发（监听构建 + 推送更新）：`pnpm watch`
- 生产构建：`pnpm build`
- 开发构建（非压缩）：`pnpm build:dev`

产物输出到仓库根目录：`dist/催眠APP前端/index.html`。

## 关于本目录下的 `package.json` / `vite.config.ts`

这两者属于历史遗留（独立 Vite 项目残留），**不参与**当前仓库的打包流程；为避免误用，本目录内的 `npm run dev/build` 已被改为直接报错提示，请按上面的根目录命令执行。

## 协作说明

详见：`src/催眠APP前端/协作说明.md`。
