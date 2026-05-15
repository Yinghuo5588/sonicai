# SonicAI - Music Recommendation System
  此项目全部由AI完成

音乐推荐管理系统，基于 Last.fm 数据生成推荐歌单并同步到 Navidrome。

## 功能

- 基于 Last.fm 生成两类推荐歌单（相似曲目、相邻艺术家）
- 同步到 Navidrome 创建歌单
- 缺失曲目批量 Webhook 通知
- 完整 Web 管理后台
- 手动执行 + Cron 定时执行
- 单管理员账户

## 快速开始

### 1. 配置 PostgreSQL 数据库

需要先在现有 PostgreSQL 中创建数据库和用户：

```sql
CREATE USER musicrec_user WITH PASSWORD 'strong_password';
CREATE DATABASE musicrec OWNER musicrec_user;
GRANT ALL PRIVILEGES ON DATABASE musicrec TO musicrec_user;
```

### 2. 配置 .env

```bash
cp .env.example .env
# 编辑 .env，填入密码和密钥
```

### 3. 启动服务

```bash
cd deploy
docker compose up -d
```

访问 http://localhost:5173

### 4. 初始化管理员

首次启动时，如果数据库中没有用户，会自动使用 `.env` 中的
`INIT_ADMIN_USERNAME` / `INIT_ADMIN_PASSWORD` / `INIT_ADMIN_EMAIL`
创建管理员账户。

## 项目结构

```
sonicai/
├── backend/          # FastAPI 后端
│ ├── app/
│ │ ├── api/routes/   # API 路由
│ │ ├── core/         # 核心配置、安全、调度器
│ │ ├── db/           # 数据库模型和会话
│ │ ├── services/     # Last.fm / Navidrome / Webhook 服务
│ │ ├── tasks/        # 后台任务
│ │ └── utils/        # 文本标准化等工具
│ ├── alembic/         # 数据库迁移
│ └── requirements.txt
├── frontend/         # React + Vite 前端
│ ├── src/
│ │   ├── pages/      # 页面组件
│ │   ├── layouts/    # 布局组件
│ │   └── hooks/      # 状态管理
│ └── package.json
└── deploy/            # Docker 部署
    ├── docker-compose.yml
    └── .env.example
```

## 配置说明

### 生产环境密钥

生产环境必须设置以下密钥，请勿使用示例中的默认值：

```env
ENV=production
JWT_SECRET_KEY=<强随机字符串>
JWT_REFRESH_SECRET_KEY=<强随机字符串>
ENCRYPTION_KEY=<强随机字符串>
```

说明：

- `JWT_SECRET_KEY`：用于签发访问令牌
- `JWT_REFRESH_SECRET_KEY`：用于签发刷新令牌
- `ENCRYPTION_KEY`：用于加密数据库中的敏感配置，例如 Navidrome 密码

**重要**：

1. `ENCRYPTION_KEY` 必须长期保持稳定。迁移服务器、恢复数据库或备份还原时，必须同时保留原来的 `ENCRYPTION_KEY`，否则已加密的 Navidrome 密码将无法解密
2. 如果丢失或更换 `ENCRYPTION_KEY`，需要在设置页重新填写并保存 Navidrome 密码
3. 生产环境不要使用 `change-in-production` 示例值

## 开发

```bash
# 后端
cd backend
pip install -r requirements.txt
python run.py

# 前端
cd frontend
npm install
npm run dev
```