"""MySQL DDL for the unified patent-family database.

Single source of truth for both the SQLite->MySQL migration entry point and the
Excel->MySQL builder. Sizes come from the delivered dataset's real maxima with
headroom; STRICT_TRANS_TABLES is enabled on the server, so under-sizing a column
would fail loudly instead of silently truncating.

``families`` keeps the upstream IncoPat Chinese column names, so identifiers
here are always backtick-quoted (MySQL treats double quotes as string literals
unless ANSI_QUOTES is set).
"""
from __future__ import annotations

FAMILY_SOURCE_FIELDS: tuple[str, ...] = (
    "序号", "家族ID", "家族代表公开（公告）号", "完整简单同族成员数",
    "家族国家/地区数量", "家族IPC数量", "家族申请人数", "家族发明人数",
    "家族是否有效", "标题 (中文)", "标题 (英文)", "摘要 (中文)",
    "摘要 (英文)", "首项权利要求-中文", "独立权利要求", "技术功效句",
    "用途", "IPC", "IPC主分类-小类", "IPC主分类-小类(释义)",
    "国民经济分类", "国民经济行业(主)", "新兴产业分类", "新兴产业(主)",
    "申请人", "标准化申请人", "当前权利人", "标准化当前权利人",
    "申请人终属母公司(中文)", "申请人终属母公司(英文)", "申请人类型",
    "申请人国家/地区", "申请人省市代码", "中国申请人地市", "中国申请人区县",
    "当前专利权人地址", "家族引证", "家族被引证", "简单同族",
    "同族国家/地区", "优先权日", "最早优先权日", "优先权国别",
    "首次公开日", "合享价值度", "技术稳定性", "技术先进性", "保护范围",
    "DWPI标题", "DWPI用途", "DWPI优势", "DWPI新颖性", "DWPI详细描述",
    "DWPI技术要点", "DWPI分类号",
)

# utf8mb4_bin 而不是任何 *_ci/*_ai_ci：SQLite 的文本比较是二进制的，而 MySQL 的
# utf8mb4_unicode_ci 连重音都不敏感，会把 "Université Grenoble Alpes" 和 ASCII
# 转写的 "Universite Grenoble Alpes" 判为同一家机构 —— 实测撞唯一键 48 行，
# 且会静默合并 DISTINCT/GROUP BY 结果。二进制排序规则保持与源库一致的比较语义。
ENGINE = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin"

# Load order matters for the foreign keys; parents first.
TABLE_ORDER: tuple[str, ...] = (
    "metadata",
    "families",
    "family_tech",
    "entities",
    "family_entities",
    "family_applicants",
    "owner_name_locations",
    "entity_locations",
    "family_applicant_geographies",
    "family_entity_comparison",
    "quality_metrics",
)

# 专利全文字段可远超 TEXT 的 64KB 上限（实测 "首项权利要求-中文" 峰值 87,258
# 字节），服务端开着 STRICT 模式会直接报 1406，故全文列统一用 MEDIUMTEXT。
_FAMILY_COLUMNS = ",\n            ".join(f"`{field}` MEDIUMTEXT" for field in FAMILY_SOURCE_FIELDS)

TABLES: dict[str, str] = {
    "metadata": f"""
        CREATE TABLE metadata(
            `key` VARCHAR(128) PRIMARY KEY,
            `value` TEXT NOT NULL
        ) {ENGINE}""",
    "families": f"""
        CREATE TABLE families(
            family_id VARCHAR(64) PRIMARY KEY,
            source_patent_id INT NOT NULL UNIQUE,
            priority_year INT,
            {_FAMILY_COLUMNS}
        ) {ENGINE}""",
    "family_tech": f"""
        CREATE TABLE family_tech(
            family_id VARCHAR(64) PRIMARY KEY,
            processing_status VARCHAR(32) NOT NULL,
            technical_feature VARCHAR(255) NOT NULL,
            technology_code VARCHAR(16) NOT NULL,
            technology_label VARCHAR(64) NOT NULL,
            route_code VARCHAR(16) NOT NULL,
            route_label VARCHAR(128) NOT NULL,
            chain_level3_code VARCHAR(32) NOT NULL,
            chain_level1 VARCHAR(64) NOT NULL,
            chain_level2 VARCHAR(128) NOT NULL,
            chain_level3 VARCHAR(128) NOT NULL,
            rationale VARCHAR(512) NOT NULL,
            confidence VARCHAR(32) NOT NULL,
            error_message TEXT,
            CONSTRAINT fk_tech_family FOREIGN KEY(family_id) REFERENCES families(family_id)
        ) {ENGINE}""",
    "entities": f"""
        CREATE TABLE entities(
            entity_id INT PRIMARY KEY,
            representative_name VARCHAR(512) NOT NULL UNIQUE,
            enterprise_type VARCHAR(64) NOT NULL,
            source_part VARCHAR(255),
            source_row INT
        ) {ENGINE}""",
    "family_entities": f"""
        CREATE TABLE family_entities(
            family_id VARCHAR(64) NOT NULL,
            entity_order INT NOT NULL,
            entity_id INT,
            entity_name VARCHAR(512) NOT NULL,
            entity_source VARCHAR(64) NOT NULL,
            enterprise_type VARCHAR(64) NOT NULL,
            match_status VARCHAR(64) NOT NULL,
            PRIMARY KEY(family_id, entity_order),
            CONSTRAINT fk_fe_family FOREIGN KEY(family_id) REFERENCES families(family_id),
            CONSTRAINT fk_fe_entity FOREIGN KEY(entity_id) REFERENCES entities(entity_id)
        ) {ENGINE}""",
    "family_applicants": f"""
        CREATE TABLE family_applicants(
            family_id VARCHAR(64) NOT NULL,
            applicant_order INT NOT NULL,
            applicant_name VARCHAR(512) NOT NULL,
            entity_id INT,
            enterprise_type VARCHAR(64) NOT NULL,
            match_status VARCHAR(64) NOT NULL,
            PRIMARY KEY(family_id, applicant_order),
            CONSTRAINT fk_fa_family FOREIGN KEY(family_id) REFERENCES families(family_id),
            CONSTRAINT fk_fa_entity FOREIGN KEY(entity_id) REFERENCES entities(entity_id)
        ) {ENGINE}""",
    "owner_name_locations": f"""
        CREATE TABLE owner_name_locations(
            owner_name VARCHAR(512) PRIMARY KEY,
            entity_id INT,
            raw_country VARCHAR(64),
            country VARCHAR(64) NOT NULL,
            province VARCHAR(64),
            city VARCHAR(64),
            location_source VARCHAR(64) NOT NULL,
            confidence VARCHAR(32),
            evidence_count INT NOT NULL,
            CONSTRAINT fk_onl_entity FOREIGN KEY(entity_id) REFERENCES entities(entity_id)
        ) {ENGINE}""",
    "entity_locations": f"""
        CREATE TABLE entity_locations(
            entity_id INT PRIMARY KEY,
            raw_country VARCHAR(64),
            country VARCHAR(64) NOT NULL,
            province VARCHAR(64),
            city VARCHAR(64),
            location_source VARCHAR(64) NOT NULL,
            evidence_count INT NOT NULL,
            CONSTRAINT fk_el_entity FOREIGN KEY(entity_id) REFERENCES entities(entity_id)
        ) {ENGINE}""",
    "family_applicant_geographies": f"""
        CREATE TABLE family_applicant_geographies(
            family_id VARCHAR(64) NOT NULL,
            geo_order INT NOT NULL,
            raw_country VARCHAR(64),
            country VARCHAR(64) NOT NULL,
            province VARCHAR(64),
            city VARCHAR(64),
            district VARCHAR(128),
            PRIMARY KEY(family_id, geo_order),
            CONSTRAINT fk_fag_family FOREIGN KEY(family_id) REFERENCES families(family_id)
        ) {ENGINE}""",
    "family_entity_comparison": f"""
        CREATE TABLE family_entity_comparison(
            family_id VARCHAR(64) PRIMARY KEY,
            applicant_entities TEXT,
            current_owner_entities TEXT,
            both_present TINYINT NOT NULL,
            raw_sets_equal TINYINT NOT NULL,
            CONSTRAINT fk_fec_family FOREIGN KEY(family_id) REFERENCES families(family_id)
        ) {ENGINE}""",
    "quality_metrics": f"""
        CREATE TABLE quality_metrics(
            metric VARCHAR(128) PRIMARY KEY,
            `value` VARCHAR(512) NOT NULL,
            status VARCHAR(32) NOT NULL,
            note TEXT
        ) {ENGINE}""",
}

INDEXES: tuple[str, ...] = (
    "CREATE INDEX idx_family_priority_year ON families(priority_year)",
    "CREATE INDEX idx_tech_code ON family_tech(technology_code)",
    "CREATE INDEX idx_tech_chain1 ON family_tech(chain_level1)",
    "CREATE INDEX idx_family_entity_entity ON family_entities(entity_id, family_id)",
    "CREATE INDEX idx_family_entity_type ON family_entities(enterprise_type, family_id)",
    "CREATE INDEX idx_family_applicant_entity ON family_applicants(entity_id, family_id)",
    "CREATE INDEX idx_family_applicant_type ON family_applicants(enterprise_type, family_id)",
    "CREATE INDEX idx_owner_location_country ON owner_name_locations(country)",
    "CREATE INDEX idx_entity_location_country ON entity_locations(country)",
    "CREATE INDEX idx_applicant_geo_country ON family_applicant_geographies(country, family_id)",
    "CREATE INDEX idx_applicant_geo_china ON family_applicant_geographies(province, city, family_id)",
)

VIEWS: tuple[str, ...] = (
    """
        CREATE VIEW v_family_complete AS
        SELECT f.*, t.technical_feature, t.technology_code, t.technology_label,
               t.route_code, t.route_label, t.chain_level3_code,
               t.chain_level1, t.chain_level2, t.chain_level3,
               t.rationale AS classification_rationale,
               t.confidence AS classification_confidence
        FROM families f JOIN family_tech t USING(family_id)
    """,
    """
        CREATE VIEW v_family_current_owner_geography AS
        SELECT fe.family_id, fe.entity_order, fe.entity_id, fe.entity_name,
               fe.enterprise_type, el.raw_country, el.country, el.province,
               el.city, el.location_source
        FROM family_entities fe LEFT JOIN entity_locations el USING(entity_id)
    """,
)

VIEW_NAMES: tuple[str, ...] = ("v_family_complete", "v_family_current_owner_geography")


def create_statements() -> list[str]:
    """Full schema build: tables in dependency order, then indexes and views."""
    return ([TABLES[name] for name in TABLE_ORDER] + list(INDEXES) + list(VIEWS))


def drop_statements() -> list[str]:
    """Views first, then tables in reverse dependency order."""
    return (
        [f"DROP VIEW IF EXISTS {name}" for name in VIEW_NAMES]
        + [f"DROP TABLE IF EXISTS {name}" for name in reversed(TABLE_ORDER)]
    )


# Replaces the sqlite "PRAGMA integrity_check" gate: loads run with
# FOREIGN_KEY_CHECKS=0 for speed and insert-order tolerance, so orphans are
# counted explicitly afterwards and must be zero.
ORPHAN_CHECKS: tuple[tuple[str, str], ...] = (
    ("family_tech", "SELECT COUNT(*) FROM family_tech t LEFT JOIN families f USING(family_id) WHERE f.family_id IS NULL"),
    ("family_entities", "SELECT COUNT(*) FROM family_entities c LEFT JOIN families f USING(family_id) WHERE f.family_id IS NULL"),
    ("family_applicants", "SELECT COUNT(*) FROM family_applicants c LEFT JOIN families f USING(family_id) WHERE f.family_id IS NULL"),
    ("family_applicant_geographies", "SELECT COUNT(*) FROM family_applicant_geographies c LEFT JOIN families f USING(family_id) WHERE f.family_id IS NULL"),
    ("family_entity_comparison", "SELECT COUNT(*) FROM family_entity_comparison c LEFT JOIN families f USING(family_id) WHERE f.family_id IS NULL"),
    ("entity_locations", "SELECT COUNT(*) FROM entity_locations c LEFT JOIN entities e USING(entity_id) WHERE e.entity_id IS NULL"),
    ("family_entities.entity", "SELECT COUNT(*) FROM family_entities c LEFT JOIN entities e USING(entity_id) WHERE c.entity_id IS NOT NULL AND e.entity_id IS NULL"),
    ("family_applicants.entity", "SELECT COUNT(*) FROM family_applicants c LEFT JOIN entities e USING(entity_id) WHERE c.entity_id IS NOT NULL AND e.entity_id IS NULL"),
    ("owner_name_locations.entity", "SELECT COUNT(*) FROM owner_name_locations c LEFT JOIN entities e USING(entity_id) WHERE c.entity_id IS NOT NULL AND e.entity_id IS NULL"),
)


def find_orphans(connection) -> dict[str, int]:
    """Return orphan-row counts per relationship; an empty/zero result is clean."""
    counts = {label: int(connection.execute(sql).fetchone()[0]) for label, sql in ORPHAN_CHECKS}
    return {label: count for label, count in counts.items() if count}
