'use server';

// ── Server Actions for Generic Detail Page ────────────────────────────────────
// All CRUD operations go directly to Prisma — no internal HTTP fetch.

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/prisma/client';
import {
  PrismaDelegate,
  DmmfField,
  DmmfModel,
  toAccessor,
  getDelegate,
  getDelegateByAccessor,
} from '@/lib/erpnext/prisma-delegate';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getModel(doctype: string): { model: PrismaDelegate; accessor: string } | null {
  const accessor = toAccessor(doctype);
  const model = getDelegate(prisma, doctype);
  if (!model) return null;
  return { model, accessor };
}

function findChildAccessors(doctype: string): string[] {
  const results: string[] = [];
  const dmmfModels = Prisma.dmmf.datamodel.models as unknown as DmmfModel[];

  for (const m of dmmfModels) {
    const hasParentType = m.fields.some((f: DmmfField) => f.name === 'parenttype');
    const hasParent = m.fields.some((f: DmmfField) => f.name === 'parent');
    if (hasParentType && hasParent) {
      const defaultMatchesParent = m.fields.some(
        (f: DmmfField) =>
          f.name === 'parenttype' &&
          f.default != null &&
          (String(f.default) === doctype ||
            (typeof f.default === 'object' && f.default !== null && String((f.default as { value: string }).value) === doctype)),
      );
      if (defaultMatchesParent || m.name.startsWith(doctype)) {
        results.push(toAccessor(m.name));
      }
    }
  }
  return results;
}

function serializeDates(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (value && typeof value === 'object' && 'toJSON' in value) {
      out[key] = String(value);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === 'object' && !(item instanceof Date)
          ? serializeDates(item as Record<string, unknown>)
          : item instanceof Date
            ? item.toISOString()
            : item,
      );
    } else if (value && typeof value === 'object') {
      out[key] = serializeDates(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ── Fetch Single Record ──────────────────────────────────────────────────────

export async function fetchDoctypeRecord(
  doctype: string,
  name: string,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const resolved = getModel(doctype);
    if (!resolved) return { success: false, error: `Unknown DocType: ${doctype}` };

    const { model } = resolved;
    const record = await model.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!record) return { success: false, error: 'NOT_FOUND' };

    // Fetch child tables
    const childAccessors = findChildAccessors(doctype);
    const children: Record<string, unknown[]> = {};

    await Promise.all(
      childAccessors.map(async (accessor) => {
        const childModel = getDelegateByAccessor(prisma as unknown as Record<string, unknown>, accessor);
        if (childModel) {
          const rows = await childModel.findMany({
            where: { parent: name },
            orderBy: { idx: 'asc' },
          });
          for (const row of rows as Record<string, unknown>[]) {
            const field = (row.parentfield as string) || 'items';
            if (!children[field]) children[field] = [];
            children[field].push(serializeDates(row));
          }
        }
      }),
    );

    return { success: true, data: { ...serializeDates(record), ...children } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fetchDoctypeRecord]', message);
    return { success: false, error: message };
  }
}

// ── Update Record ─────────────────────────────────────────────────────────────

export async function updateDoctypeRecord(
  doctype: string,
  name: string,
  data: Record<string, unknown>,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const resolved = getModel(doctype);
    if (!resolved) return { success: false, error: `Unknown DocType: ${doctype}` };
    const { model, accessor } = resolved;

    const existing = await model.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!existing) return { success: false, error: 'NOT_FOUND' };
    if (existing.docstatus === 1) return { success: false, error: 'Cannot update submitted record' };
    if (existing.docstatus === 2) return { success: false, error: 'Cannot update cancelled record' };

    // Separate child tables from parent fields
    const childTables: Record<string, unknown[]> = {};
    const parentFields: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val)) {
        childTables[key] = val;
      } else if (key !== 'name' && key !== 'creation' && key !== 'owner' && key !== 'docstatus') {
        parentFields[key] = val;
      }
    }

    parentFields.modified = new Date();
    parentFields.modified_by = 'Administrator';

    const result = await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, PrismaDelegate>;
      await txRecord[accessor].update({ where: { name }, data: parentFields });

      // Update child tables
      const childAccessors = findChildAccessors(doctype);
      for (const [field, rows] of Object.entries(childTables)) {
        let childAccessor: string | null = null;
        for (const ca of childAccessors) {
          const childDelegate = txRecord[ca];
          if (childDelegate) {
            const sample = await childDelegate.findFirst({ where: { parent: name, parentfield: field } });
            if (sample) { childAccessor = ca; break; }
          }
        }

        if (childAccessor) {
          const childModel = txRecord[childAccessor];
          await childModel.deleteMany({ where: { parent: name, parentfield: field } });
          if (rows.length > 0) {
            const childRows = (rows as Record<string, unknown>[]).map((row, i) => ({
              ...row,
              parent: name,
              parentfield: field,
              parenttype: doctype,
              idx: row.idx ?? i + 1,
            }));
            await childModel.createMany({ data: childRows });
          }
        }
      }

      return await txRecord[accessor].findUnique({ where: { name } });
    });

    return { success: true, data: serializeDates(result as Record<string, unknown>) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[updateDoctypeRecord]', message);
    return { success: false, error: message };
  }
}

// ── Delete Record ─────────────────────────────────────────────────────────────

export async function deleteDoctypeRecord(
  doctype: string,
  name: string,
): Promise<ActionResult<{ message: string; deleted_children: number }>> {
  try {
    const resolved = getModel(doctype);
    if (!resolved) return { success: false, error: `Unknown DocType: ${doctype}` };
    const { model, accessor } = resolved;

    const existing = await model.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!existing) return { success: false, error: 'NOT_FOUND' };
    if (existing.docstatus !== 0) {
      return { success: false, error: existing.docstatus === 1 ? 'Cannot delete submitted record. Cancel it first.' : 'Cannot delete cancelled record' };
    }

    const childAccessors = findChildAccessors(doctype);
    let childCount = 0;
    for (const childAccessor of childAccessors) {
      const childModel = getDelegateByAccessor(prisma as unknown as Record<string, unknown>, childAccessor);
      if (childModel) {
        childCount += await childModel.count({ where: { parent: name } });
      }
    }

    await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, PrismaDelegate>;
      for (const childAccessor of childAccessors) {
        const childDelegate = txRecord[childAccessor];
        if (childDelegate) await childDelegate.deleteMany({ where: { parent: name } });
      }
      await txRecord[accessor].delete({ where: { name } });
    });

    return { success: true, data: { message: `${doctype} "${name}" deleted`, deleted_children: childCount } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[deleteDoctypeRecord]', message);
    return { success: false, error: message };
  }
}

// ── Submit Record ─────────────────────────────────────────────────────────────

export async function submitDoctypeRecord(
  doctype: string,
  name: string,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const resolved = getModel(doctype);
    if (!resolved) return { success: false, error: `Unknown DocType: ${doctype}` };
    const { model, accessor } = resolved;

    const existing = await model.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!existing) return { success: false, error: 'NOT_FOUND' };
    if (existing.docstatus !== 0) return { success: false, error: 'Only Draft records can be submitted' };

    const result = await (prisma as unknown as Record<string, PrismaDelegate>)[accessor].update({
      where: { name },
      data: { docstatus: 1, modified: new Date(), modified_by: 'Administrator' },
    });

    return { success: true, data: serializeDates(result as Record<string, unknown>) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[submitDoctypeRecord]', message);
    return { success: false, error: message };
  }
}

// ── Cancel Record ─────────────────────────────────────────────────────────────

export async function cancelDoctypeRecord(
  doctype: string,
  name: string,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const resolved = getModel(doctype);
    if (!resolved) return { success: false, error: `Unknown DocType: ${doctype}` };
    const { model, accessor } = resolved;

    const existing = await model.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!existing) return { success: false, error: 'NOT_FOUND' };
    if (existing.docstatus !== 1) return { success: false, error: 'Only Submitted records can be cancelled' };

    const result = await (prisma as unknown as Record<string, PrismaDelegate>)[accessor].update({
      where: { name },
      data: { docstatus: 2, modified: new Date(), modified_by: 'Administrator' },
    });

    return { success: true, data: serializeDates(result as Record<string, unknown>) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cancelDoctypeRecord]', message);
    return { success: false, error: message };
  }
}
