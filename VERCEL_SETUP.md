# Vercel + Neon + GitHub Actions 部署

目标仓库：`https://github.com/Martin-Yoann/Naraka`。此方案无需 Docker。代码适配已完成；远程连接、已有数据迁移、Vercel 发布和 Actions 实跑需要账号配置后验证。

## 1. 创建 Neon 项目

在 Neon 控制台创建项目，选择靠近访问人群且可与 Vercel 对应的区域。在 Connect 面板开启 connection pooling，复制 PostgreSQL 连接串（通常主机名包含 `-pooler`）。保留连接串中的 TLS 参数，不要删除 `sslmode`。

本机安装 Node 24，在项目根目录 `.env` 中加入：

```dotenv
DATABASE_URL=这里填写Neon连接串
```

不要把真实连接串发到聊天、提交到仓库或放入浏览器代码。`.env` 已忽略。

```powershell
npm ci
npm run db:migrate
npm run db:seed
```

`db:seed` 在保存已有 SQLite 数据的电脑上运行。先完成迁移再启用 Actions 采集；不要在采集正在运行时迁移。它会复制商品、行情批次、媒体、分页断点和抽签历史低价基线；云端已有其他来源行情时会拒绝初始化。相同来源可在失败后重试；迁移过程中应保持本机采集暂停，避免源数据改变。首次无法迁移本机数据时，也可以让 Actions 从空数据库开始收集，旧历史则尚未转入。

## 2. 创建 Vercel 项目

1. 在 Vercel 选择 Add New → Project，导入 `Martin-Yoann/Naraka`。
2. Framework Preset 使用 Other；Root Directory 使用仓库根目录。
3. Node.js 版本选择 24；配置已写入 `vercel.json`，构建命令 `npm run build:vercel`，输出目录 `.vercel-static`。
4. 在 Environment Variables 添加 `DATABASE_URL`，值为同一 Neon pooled 连接串。至少勾选 Production；如果要测试预览，也配置 Preview。
5. Deploy。环境变量变更后重新部署。

API 不会在每次请求时建表，必须先成功执行 `db:migrate` 或 Actions 中的初始化步骤。

## 3. 配置 GitHub Actions

已有数据迁移完成后，进入仓库 Settings → Secrets and variables → Actions → New repository secret：

| 名称 | 值 |
| --- | --- |
| `DATABASE_URL` | Neon pooled 连接串 |

在 Actions 中选择 **Collect real CBG market data** → Run workflow。先手动执行成功，再观察自动运行。

工作流在每小时 UTC 第7和第37分钟运行，即北京时间每小时第7和第37分钟。GitHub 可能延迟或跳过定时任务，页面会显示真实采集时间。每轮上限6分钟，工作流上限12分钟；工作流并发控制和数据库租约共同避免重复采集。失败保留已保存的页码和商品，下轮继续。不会通过提交 JSON 或重新部署来更新行情。

仓库当前为公开；若改为私有，需核对账号 Actions 分钟额度。Vercel Hobby 仅适用于其条款允许的个人非商业使用。

## 4. 验收

- `/api/health` 返回 `status: ok`、`storage: postgres`。
- `/api/collection` 显示实际采集条目与更新时间。
- 自定搜索显示“云端实时库存库”，分页查询每页20件。
- 预览从云端单件接口读取完整图片，不依赖本机库存快照。
- 关闭本机电脑后，手动 Actions 工作流仍能更新云端进度。
- 外部请求被藏宝阁限流或拒绝时，工作流失败并保存错误，页面不能据此认定商品成交。

趋势接口分批读取最近30天的已观察行情，后续刷新按游标增量读取。抽签历史最低价独立持久保存，跨越趋势窗口。数据库中的历史批次当前不会自动删除，需要持续观察免费存储额度。

微信登录和公众号发送在此云端版本尚未启用；本机已有实现保留。浏览器本机订阅仍要求网页保持打开。
