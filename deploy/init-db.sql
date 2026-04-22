# SonicAI 数据库初始化脚本
# 在 emby-postgres 容器中执行：
#   docker exec -it emby-postgres psql -U postgres -c "$(cat init-db.sql)"

CREATE USER musicrec_user WITH PASSWORD 'change_me_to_strong_password';
CREATE DATABASE musicrec OWNER musicrec_user;
GRANT ALL PRIVILEGES ON DATABASE musicrec TO musicrec_user;
