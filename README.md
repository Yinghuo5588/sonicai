# SonicAI - Music Recommendation System

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

详见系统设计文档。

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