# V2.2 常驻部署

现有 Sites 地址仍发布静态快照。本目录新增的 Docker Compose 用于你自己的常驻 Linux 服务器，尚未部署到远程服务器。

1. 服务器安装 Docker Engine 与 Compose。上传项目，排除 `.env`、`node_modules` 和日志。
2. 首次运行 `docker compose build`，然后 `docker compose up -d`。
3. 使用 `docker compose logs --tail=100 collector` 查看采集。采集器立即执行一轮，此后按开始时间每30分钟触发；每轮最多6分钟，失败保留已写入数据，下轮重试。
4. 通过服务器反向代理把域名的 HTTPS 请求转发到 `127.0.0.1:3100`。应用端口默认只绑定服务器回环地址。
5. 检查 `/api/health`、`/api/collection` 和 `/api/inventory/search`。第一次采集前数据库为空；镜像中的快照仅供参考。

`market-data` 保存 SQLite 数据库，`market-export` 保存库存预览快照，`market-snapshots` 保存采集状态和行情导出。更新代码执行 `docker compose up -d --build`。保留这些卷，定期备份；不要执行带 `-v` 的清理命令。

若要迁移现有 Windows 数据，先停止两边采集和服务，将 `data` 中 SQLite 数据库连同 WAL 文件一致备份后恢复到 `market-data`，再启动服务。请勿直接复制正在写入的单个数据库文件。

微信登录和公众号通知尚未配置。后续通过服务器环境变量注入配置，不能把 AppSecret 写进前端或仓库。此部署配置目前未经过实际 Docker 构建和远程运行验证。
