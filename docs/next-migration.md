# Next.js 迁移（V2.4）

线上使用 Next.js 16 App Router、React 19、Node.js 24、Neon PostgreSQL。页面壳由 Server Component 预渲染，交互模块在 hydration 后初始化。已有搜索、图鉴、比较、洗练、行情、抽签和预览模块继续复用，尚未逐个重写为 React 状态组件。

## 开发与构建

先运行 `npm ci`，在 `.env.local` 或 `.env` 中配置真实 `DATABASE_URL`。不要使用 `NEXT_PUBLIC_` 暴露数据库连接串。

```sh
npm run dev
npm test
npm run build
npm start
```

Next.js 默认使用 3000 端口；原 SQLite 本机服务通过 `npm run start:local` 启动，继续使用 3100 端口。现有 Windows 本机任务仍执行原服务脚本。

## 文件与路由

- `app/layout.jsx`：全局样式、共享布局、元数据、连接预热。
- `app/components/portal-shell.jsx`：服务器预渲染的页面壳，后续修改 Next 页面结构应在这里进行。
- `app/components/portal-runtime.jsx`：交互初始化、GSAP、Next 原生 History API 导航与预加载。
- `app/[view]/page.jsx`：预生成工具地址及标题。支持 `/search`、`/compare`、`/gallery`、`/simulator`、`/trends`、`/market`、`/watch`、`/calculator`、`/lottery`。原 hash 地址保留兼容。
- `app/api/[...route]/route.js`：Node.js Route Handler，每次请求读取云端服务，不缓存价格。
- `lib/cloud-handler.mjs`：与测试共用的服务逻辑；数据库凭证只在服务器读取。
- `scripts/prepare-next.mjs`：将图片与图鉴资源复制到生成目录 `public/`，不复制行情、库存、密钥和本地数据库。

交互页面保留在共享布局内，切换地址不会销毁选中的比较商品或重复注册事件。Next 原生 History API 同步 `usePathname`，浏览器前进/后退也会切换工作区。现有 DOM 交互模块管理自己的内容，React 路由组件不重复渲染这些内容。

## Vercel 与采集

Vercel Framework Preset 使用 Next.js，Build Command 为 `npm run build`，Output Directory 使用框架默认值（清除原 `.vercel-static` 覆盖）。生产与预览按需配置服务器变量 `DATABASE_URL`。

GitHub Actions 每小时第 7、37 分钟运行原采集任务，将真实观察写入 Neon；GitHub 免费计划的定时执行可能延迟。Vercel API 只读取数据库或按用户操作核验单件商品，不在请求期间执行整轮抓取。微信功能继续按当前配置状态禁用。

## 验证

先启动连接真实 Neon 的 Next.js 生产服务，再运行：

```sh
node scripts/next-qa.mjs
```

默认地址 `http://127.0.0.1:3200`；可通过 `SITE_URL` 指定本地或正式地址。测试直接读取真实数据，覆盖 Next 资源、页面直达、前进后退、比较状态、高清预览、抽签字段及移动端边界；需要本机 Chrome。
