-- SonicAI 数据库初始化脚本
-- PostgreSQL 16
-- 运行位置：已有 emby-postgres 容器

-- 创建专用用户和数据库
CREATE USER musicrec_user WITH PASSWORD 'change_me_to_strong_password';
CREATE DATABASE musicrec OWNER musicrec_user;
GRANT ALL PRIVILEGES ON DATABASE musicrec TO musicrec_user;

-- 连接示例（你的项目中 .env 填入）：
-- DATABASE_URL=postgresql+psycopg://musicrec_user:change_me_to_strong_password@emby-postgres:5432/musicrec