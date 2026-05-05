#!/usr/bin/env python3
"""Generate TypeScript types from Python Pydantic schemas.

Run: python scripts/generate_types.py
Output: frontend/src/types/api.ts

This ensures frontend types stay in sync with backend schemas.
No more hardcoded magic strings.
"""

import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.models.enquiry import EnquiryStatus
from backend.app.schemas.enquiry import (
    EnquiryCreate,
    EnquiryRead,
    EnquiryUpdate,
    DocumentRead,
    WikiPageRead,
    WikiSearchResult,
    PipelineRunRequest,
    PipelineRunResponse,
)


def _py_type_to_ts(py_type: str) -> str:
    mapping = {
        "str": "string",
        "int": "number",
        "float": "number",
        "bool": "boolean",
        "UUID": "string",
        "datetime": "string",
        "NoneType": "null",
    }
    return mapping.get(py_type, "unknown")


def _enum_to_ts(enum_class) -> str:
    """Convert a Python Enum to a TypeScript union type."""
    values = [f'"{v.value}"' for v in enum_class]
    return " | ".join(values)


def _schema_to_ts_interface(name: str, schema: dict, enums: dict | None = None) -> str:
    """Convert a Pydantic JSON schema to a TypeScript interface."""
    lines = [f"export interface {name} {{"]

    properties = schema.get("properties", {})
    required = set(schema.get("required", []))

    for field_name, field_schema in properties.items():
        ts_type = "unknown"

        if "$ref" in field_schema:
            ref_name = field_schema["$ref"].split("/")[-1]
            ts_type = ref_name
        elif "anyOf" in field_schema:
            parts = []
            for part in field_schema["anyOf"]:
                if part.get("type") == "null":
                    parts.append("null")
                elif part.get("type") == "string":
                    ts_type = "string"
                    if "enum" in part.get("description", "") or "format" in part:
                        parts.append(ts_type)
                    else:
                        parts.append(ts_type)
                else:
                    parts.append(_py_type_to_ts(part.get("type", "unknown")))
            ts_type = " | ".join(parts)
        elif field_schema.get("type") == "array":
            items = field_schema.get("items", {})
            if items.get("type") == "string":
                ts_type = "string[]"
            elif items.get("type") == "number":
                ts_type = "number[]"
            elif "$ref" in items:
                ts_type = f"{items['$ref'].split('/')[-1]}[]"
            else:
                ts_type = "unknown[]"
        elif field_schema.get("type") == "object":
            ts_type = "Record<string, unknown>"
        elif field_schema.get("type") == "string":
            ts_type = "string"
        elif field_schema.get("type") == "number":
            ts_type = "number"
        elif field_schema.get("type") == "integer":
            ts_type = "number"
        elif field_schema.get("type") == "boolean":
            ts_type = "boolean"

        optional = "" if field_name in required else "?"
        lines.append(f"  {field_name}{optional}: {ts_type};")

    lines.append("}")
    return "\n".join(lines)


def generate():
    # Generate schemas
    schemas = {
        "EnquiryCreate": EnquiryCreate,
        "EnquiryRead": EnquiryRead,
        "EnquiryUpdate": EnquiryUpdate,
        "DocumentRead": DocumentRead,
        "WikiPageRead": WikiPageRead,
        "WikiSearchResult": WikiSearchResult,
        "PipelineRunRequest": PipelineRunRequest,
        "PipelineRunResponse": PipelineRunResponse,
    }

    output = [
        "// Auto-generated from Python Pydantic schemas",
        "// Run: python scripts/generate_types.py",
        "// DO NOT EDIT MANUALLY — changes will be overwritten",
        "",
    ]

    # Generate enum
    output.append(f"export type EnquiryStatus = {_enum_to_ts(EnquiryStatus)};")
    output.append("")

    # Generate status color mapping from enum
    status_values = [v.value for v in EnquiryStatus]
    output.append("export const STATUS_COLORS: Record<EnquiryStatus, string> = {")
    for v in status_values:
        color_map = {
            "draft": "bg-zinc-100 text-zinc-700",
            "ingested": "bg-blue-50 text-blue-700",
            "classified": "bg-indigo-50 text-indigo-700",
            "rules_applied": "bg-purple-50 text-purple-700",
            "llm_drafted": "bg-amber-50 text-amber-700",
            "policy_review": "bg-teal-50 text-teal-700",
            "human_review": "bg-red-50 text-red-700",
            "approved": "bg-green-50 text-green-700",
            "executing": "bg-cyan-50 text-cyan-700",
            "completed": "bg-emerald-50 text-emerald-700",
            "rejected": "bg-red-100 text-red-800",
        }
        output.append(f'  "{v}": "{color_map.get(v, "bg-zinc-100 text-zinc-700")}",')
    output.append("};")
    output.append("")

    # Generate interfaces
    for name, schema_cls in schemas.items():
        json_schema = schema_cls.model_json_schema()
        ts_interface = _schema_to_ts_interface(name, json_schema)
        output.append(ts_interface)
        output.append("")

    # Write to frontend
    output_path = Path(__file__).resolve().parent.parent / "frontend" / "src" / "types" / "api.ts"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(output))

    print(f"Generated {output_path} with {len(schemas)} interfaces + EnquiryStatus enum")


if __name__ == "__main__":
    generate()
