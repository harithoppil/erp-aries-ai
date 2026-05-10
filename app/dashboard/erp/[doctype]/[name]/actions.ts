'use server';

// ── Server Actions for Generic Detail Page ────────────────────────────────────
// All CRUD operations for ANY ERPNext doctype via the REST API routes.

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function normalizeDoctype(doctype: string): string {
  // Convert "Sales Invoice" or "sales-invoice" or "sales%20invoice" to the proper API slug
  return doctype
    .replace(/%20/g, '-')
    .replace(/ /g, '-')
    .replace(/_/g, '-');
}

// ── Fetch Single Record ──────────────────────────────────────────────────────

export async function fetchDoctypeRecord(
  doctype: string,
  name: string,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const slug = normalizeDoctype(doctype);
    const res = await fetch(`${baseUrl()}/api/erpnext/${slug}/${encodeURIComponent(name)}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { success: false, error: 'NOT_FOUND' };
      }
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body?.error || `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (json.success && json.data) {
      return { success: true, data: json.data as Record<string, unknown> };
    }
    return { success: false, error: json?.error || 'Unexpected response format' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
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
    const slug = normalizeDoctype(doctype);
    const res = await fetch(`${baseUrl()}/api/erpnext/${slug}/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body?.error || `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (json.success) {
      return { success: true, data: json.data as Record<string, unknown> };
    }
    return { success: false, error: json?.error || 'Update failed' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
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
    const slug = normalizeDoctype(doctype);
    const res = await fetch(`${baseUrl()}/api/erpnext/${slug}/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body?.error || `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (json.success) {
      return {
        success: true,
        data: {
          message: json.data?.message || `${doctype} deleted`,
          deleted_children: json.data?.deleted_children ?? 0,
        },
      };
    }
    return { success: false, error: json?.error || 'Delete failed' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
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
    const slug = normalizeDoctype(doctype);
    const res = await fetch(
      `${baseUrl()}/api/erpnext/${slug}/${encodeURIComponent(name)}/submit`,
      { method: 'POST' },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body?.error || `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (json.success) {
      return { success: true, data: json.data as Record<string, unknown> };
    }
    return { success: false, error: json?.error || 'Submit failed' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
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
    const slug = normalizeDoctype(doctype);
    const res = await fetch(
      `${baseUrl()}/api/erpnext/${slug}/${encodeURIComponent(name)}/cancel`,
      { method: 'POST' },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body?.error || `HTTP ${res.status}` };
    }

    const json = await res.json();
    if (json.success) {
      return { success: true, data: json.data as Record<string, unknown> };
    }
    return { success: false, error: json?.error || 'Cancel failed' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    console.error('[cancelDoctypeRecord]', message);
    return { success: false, error: message };
  }
}
