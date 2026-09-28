-- 生产部署：为运行态与构建分别创建专用低权限账号，取代 root。
-- 用法：把下面的占位口令改为强口令后，用管理员执行：
--   mysql -u root -p < scripts/mysql_provision_user.sql
-- 然后把 .env 的 MYSQL_USER/MYSQL_PASSWORD 改成 fii_runtime（运行服务用）；
-- 仅在跑 build.py --rebuild / migrate 脚本时临时改用 fii_build。
--
-- 主机默认 localhost（应用与 MySQL 同机）。若应用在别的机器，把 'localhost'
-- 改成对应主机或网段（如 '10.0.0.%'）；用 '%' 表示任意主机（最不安全，慎用）。

-- 1) 运行态账号：只读 + 允许 mysqldump（serve.py 与 scripts/backup_mysql.py 用）
CREATE USER IF NOT EXISTS 'fii_runtime'@'localhost' IDENTIFIED BY '<RUNTIME_PASSWORD>';
GRANT SELECT, SHOW VIEW, TRIGGER, LOCK TABLES
  ON `future_industry_insight`.* TO 'fii_runtime'@'localhost';

-- 2) 构建账号：库级 DDL+DML（build.py --rebuild / migrate_sqlite_to_mysql.py 用）
--    只授予本库权限，不给全局权限；构建完成后应用不以该账号运行。
CREATE USER IF NOT EXISTS 'fii_build'@'localhost' IDENTIFIED BY '<BUILD_PASSWORD>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES,
      CREATE VIEW, SHOW VIEW, TRIGGER, CREATE ROUTINE, ALTER ROUTINE, EXECUTE
  ON `future_industry_insight`.* TO 'fii_build'@'localhost';

FLUSH PRIVILEGES;

-- 校验：
--   SHOW GRANTS FOR 'fii_runtime'@'localhost';
--   SHOW GRANTS FOR 'fii_build'@'localhost';
