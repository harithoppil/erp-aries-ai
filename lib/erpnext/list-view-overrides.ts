// Per-doctype list view overrides.
//
// Some doctypes need columns the metadata doesn't surface (e.g. Customer list
// shows `outstanding_amount` which doesn't have `in_list_view = 1`). This
// table acts as an escape hatch, applied in `loadDocTypeMeta()` after
// computing `list_view_fields` and before caching.

export interface ListViewOverride {
  /** Extra fieldnames to append to the list view. */
  append?: string[];
  /** Fieldnames to remove from the list view. */
  hide?: string[];
  /** Default sort configuration for the list view. */
  defaultSort?: { field: string; dir: 'asc' | 'desc' };
  /** Pre-applied filters that are always active for this doctype. */
  defaultFilters?: Record<string, unknown>;
}

export const LIST_VIEW_OVERRIDES: Record<string, ListViewOverride> = {
  Customer: {
    append: ['outstanding_amount'],
    defaultSort: { field: 'modified', dir: 'desc' },
  },
  'Sales Invoice': {
    append: ['outstanding_amount', 'due_date'],
  },
  'Purchase Invoice': {
    append: ['outstanding_amount', 'due_date'],
  },
  Item: {
    hide: ['item_code'], // Item has ~15 in_list_view columns; hide some
  },
};
