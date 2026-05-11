-- ═══════════════════════════════════════════════════════════════════════════════
-- Load tabDocField into Azure PostgreSQL
-- This table drives the metadata-driven frontend (ERPFormClient, ERPListClient).
-- Without it, all doctype pages fall back to GenericListClient/GenericDetailClient.
--
-- Run against: Azure PostgreSQL (aries-erp-ai.postgres.database.azure.com)
-- Source: local DB dump (sql/aries_site_local.sql), ~13,416 rows
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Create the table if it doesn't exist (all columns from Frappe schema)
CREATE TABLE IF NOT EXISTS public."tabDocField" (
    name character varying(255) NOT NULL,
    creation timestamp(6) without time zone DEFAULT NULL::timestamp without time zone,
    modified timestamp(6) without time zone DEFAULT NULL::timestamp without time zone,
    modified_by character varying(255) DEFAULT NULL::character varying,
    owner character varying(255) DEFAULT NULL::character varying,
    docstatus smallint DEFAULT 0 NOT NULL,
    parent character varying(255) DEFAULT NULL::character varying,
    parentfield character varying(255) DEFAULT NULL::character varying,
    parenttype character varying(255) DEFAULT NULL::character varying,
    idx bigint DEFAULT 0 NOT NULL,
    fieldname character varying(140) DEFAULT NULL::character varying,
    label character varying(255) DEFAULT NULL::character varying,
    oldfieldname character varying(140) DEFAULT NULL::character varying,
    fieldtype character varying(140) DEFAULT 'Data'::character varying,
    oldfieldtype character varying(140) DEFAULT NULL::character varying,
    options text,
    search_index smallint DEFAULT 0 NOT NULL,
    hidden smallint DEFAULT 0 NOT NULL,
    set_only_once smallint DEFAULT 0 NOT NULL,
    show_dashboard smallint DEFAULT 0 NOT NULL,
    allow_in_quick_entry smallint DEFAULT 0 NOT NULL,
    print_hide smallint DEFAULT 0 NOT NULL,
    report_hide smallint DEFAULT 0 NOT NULL,
    reqd smallint DEFAULT 0 NOT NULL,
    bold smallint DEFAULT 0 NOT NULL,
    in_global_search smallint DEFAULT 0 NOT NULL,
    collapsible smallint DEFAULT 0 NOT NULL,
    "unique" smallint DEFAULT 0 NOT NULL,
    no_copy smallint DEFAULT 0 NOT NULL,
    allow_on_submit smallint DEFAULT 0 NOT NULL,
    show_preview_popup smallint DEFAULT 0 NOT NULL,
    trigger character varying(255) DEFAULT NULL::character varying,
    collapsible_depends_on text,
    mandatory_depends_on text,
    read_only_depends_on text,
    depends_on text,
    permlevel integer DEFAULT 0 NOT NULL,
    ignore_user_permissions smallint DEFAULT 0 NOT NULL,
    width character varying(64) DEFAULT NULL::character varying,
    print_width character varying(64) DEFAULT NULL::character varying,
    columns integer DEFAULT 0 NOT NULL,
    "default" text,
    description text,
    in_list_view smallint DEFAULT 0 NOT NULL,
    fetch_if_empty smallint DEFAULT 0 NOT NULL,
    in_filter smallint DEFAULT 0 NOT NULL,
    remember_last_selected_value smallint DEFAULT 0 NOT NULL,
    ignore_xss_filter smallint DEFAULT 0 NOT NULL,
    print_hide_if_no_value smallint DEFAULT 0 NOT NULL,
    allow_bulk_edit smallint DEFAULT 0 NOT NULL,
    in_standard_filter smallint DEFAULT 0 NOT NULL,
    in_preview smallint DEFAULT 0 NOT NULL,
    read_only smallint DEFAULT 0 NOT NULL,
    "precision" character varying(140) DEFAULT NULL::character varying,
    max_height character varying(64) DEFAULT NULL::character varying,
    length integer DEFAULT 0 NOT NULL,
    translatable smallint DEFAULT 0 NOT NULL,
    hide_border smallint DEFAULT 0 NOT NULL,
    hide_days smallint DEFAULT 0 NOT NULL,
    hide_seconds smallint DEFAULT 0 NOT NULL,
    non_negative smallint DEFAULT 0 NOT NULL,
    is_virtual smallint DEFAULT 0 NOT NULL,
    not_nullable smallint DEFAULT 0 NOT NULL,
    mask smallint DEFAULT 0 NOT NULL,
    sort_options smallint DEFAULT 0 NOT NULL,
    link_filters json,
    fetch_from text,
    button_color character varying(140),
    show_on_timeline smallint DEFAULT 0 NOT NULL,
    in_import_template smallint DEFAULT 0 NOT NULL,
    sticky smallint DEFAULT 0 NOT NULL,
    make_attachment_public smallint DEFAULT 0 NOT NULL,
    alignment character varying(140),
    documentation_url character varying(140),
    placeholder character varying(140),
    show_description_on_click smallint DEFAULT 0 NOT NULL,
    CONSTRAINT "tabDocField_pkey" PRIMARY KEY (name)
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS "tabDocField_parent_idx" ON public."tabDocField" USING btree (parent);
CREATE INDEX IF NOT EXISTS "tabDocField_fieldname_idx" ON public."tabDocField" USING btree (fieldname);
CREATE INDEX IF NOT EXISTS "tabDocField_fieldtype_idx" ON public."tabDocField" USING btree (fieldtype);
CREATE INDEX IF NOT EXISTS "tabDocField_label_idx" ON public."tabDocField" USING btree (label);

-- 3. Truncate if re-running (safe — this is reference/metadata data, not transactional)
-- TRUNCATE public."tabDocField";  -- uncomment if you need to re-run

-- ═══════════════════════════════════════════════════════════════════════════════
-- IMPORTANT: After running this CREATE TABLE + indexes, you need to load the
-- COPY data from the local dump. The COPY block is ~35K lines and uses the
-- psql \copy format. Run this from a terminal with psql access:
--
--   psql "postgresql://postgres:Arieserp1!@aries-erp-ai.postgres.database.azure.com:5432/postgres?sslmode=require" \
--     -c "\copy public.\"tabDocField\" FROM 'sql/tabdocfield-data.tsv'"
--
-- To generate the TSV file, see: scripts/extract-tabdocfield.sh
-- Or just pipe directly from the local dump:
--
--   # Extract just the tabDocField COPY block and pipe to Azure:
--   sed -n '/^COPY public."tabDocField"/,/^\.$/p' sql/aries_site_local.sql | \
--     psql "postgresql://postgres:Arieserp1!@aries-erp-ai.postgres.database.azure.com:5432/postgres?sslmode=require"
--
-- ═══════════════════════════════════════════════════════════════════════════════
