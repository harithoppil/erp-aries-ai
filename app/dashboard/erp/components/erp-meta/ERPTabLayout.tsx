'use client';

import { type JSX, useMemo, useState } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { ERPFieldRenderer } from './ERPFieldRenderer';
import type {
  DocFieldMeta,
  LayoutNode,
} from '@/lib/erpnext/doctype-meta';
import { evaluateDependsOn } from '@/lib/erpnext/depends-on';

interface ERPTabLayoutProps {
  tree: LayoutNode[];
  record: Record<string, unknown>;
  editable: boolean;
  errors: Record<string, string>;
  onFieldChange: (fieldname: string, value: unknown) => void;
  /** Render slot for Table-type fields. Caller controls the grid. */
  renderTable?: (field: DocFieldMeta) => JSX.Element;
  /** Whether this is a new (unsaved) record. */
  isNew?: boolean;
  /** Current docstatus: 0=Draft, 1=Submitted, 2=Cancelled. */
  docstatus?: number;
  /** Whether the doctype is submittable (controls allow_on_submit field gating). */
  isSubmittable?: boolean;
}

function nodeFields(node: LayoutNode): DocFieldMeta[] {
  if (node.type === 'field') return [node.field];
  return node.children.flatMap(nodeFields);
}

function FieldRow(props: {
  field: DocFieldMeta;
  record: Record<string, unknown>;
  editable: boolean;
  errors: Record<string, string>;
  onFieldChange: (f: string, v: unknown) => void;
  renderTable?: (field: DocFieldMeta) => JSX.Element;
  /** True when editing an existing record (not new). Used for set_only_once. */
  isExistingRecord?: boolean;
  /** Current docstatus. Used for allow_on_submit gating. */
  docstatus?: number;
  /** Whether the doctype is submittable. */
  isSubmittable?: boolean;
  /** Dynamically computed required state from mandatory_depends_on. */
  dynamicRequired?: boolean;
  /** Dynamically computed read-only state from read_only_depends_on. */
  dynamicReadOnly?: boolean;
}): JSX.Element | null {
  const {
    field, record, editable, errors, onFieldChange, renderTable,
    isExistingRecord, docstatus, isSubmittable,
    dynamicRequired, dynamicReadOnly,
  } = props;
  if (field.hidden) return null;

  // Table-type fields: defer to caller-provided grid renderer
  if (field.fieldtype === 'Table' || field.fieldtype === 'Table MultiSelect') {
    return (
      <div className="col-span-full">
        {renderTable ? renderTable(field) : (
          <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            Child table <code className="font-mono">{field.fieldname}</code> ({field.options ?? '?'})
          </div>
        )}
      </div>
    );
  }

  // depends_on: do not render the field at all when expression evaluates false
  if (!evaluateDependsOn(field.depends_on, record)) return null;

  // set_only_once: field is read-only when editing an existing record
  const setOnlyOnce = field.set_only_once && isExistingRecord;

  // allow_on_submit: when docstatus=1 (Submitted) and doctype is submittable,
  // all fields are read-only EXCEPT those with allow_on_submit=true
  const submittedReadonly = isSubmittable && docstatus === 1 && !field.allow_on_submit;

  // Dynamic read-only from read_only_depends_on
  const dynReadOnly = dynamicReadOnly ?? false;

  const fieldEditable = editable && !setOnlyOnce && !submittedReadonly && !dynReadOnly;

  // Dynamic required from mandatory_depends_on
  const fieldRequired = field.reqd || (dynamicRequired ?? false);

  return (
    <div className="space-y-1">
      <label
        htmlFor={field.fieldname}
        className={cn('block text-sm', field.bold ? 'font-semibold' : 'font-medium')}
      >
        {field.label || field.fieldname}
        {fieldRequired && <span className="text-red-500"> *</span>}
      </label>
      <ERPFieldRenderer
        field={field}
        value={record[field.fieldname]}
        editable={fieldEditable}
        onChange={(v) => onFieldChange(field.fieldname, v)}
        error={errors[field.fieldname]}
      />
      {field.description && !errors[field.fieldname] && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}

function SectionBlock(props: {
  section: Extract<LayoutNode, { type: 'section' }>;
  record: Record<string, unknown>;
  editable: boolean;
  errors: Record<string, string>;
  onFieldChange: (f: string, v: unknown) => void;
  renderTable?: (field: DocFieldMeta) => JSX.Element;
  isExistingRecord?: boolean;
  docstatus?: number;
  isSubmittable?: boolean;
}): JSX.Element | null {
  const {
    section, record, editable, errors, onFieldChange, renderTable,
    isExistingRecord, docstatus, isSubmittable,
  } = props;
  const allFields = nodeFields(section);
  if (allFields.length === 0) return null;

  // ── collapsible_depends_on ──────────────────────────────────────────────
  // Evaluate the expression to determine initial expand/collapse state.
  const collapsibleDependsOn = allFields.find((f) => f.collapsible_depends_on)?.collapsible_depends_on ?? null;
  const initialOpen = useMemo(() => {
    if (!collapsibleDependsOn) return true;
    return evaluateDependsOn(collapsibleDependsOn, record);
  }, [collapsibleDependsOn, record]);

  const [open, setOpen] = useState(initialOpen);
  const collapsibleHeader = section.collapsible && section.label;

  // ── hide_border ─────────────────────────────────────────────────────────
  // Section Break with hide_border=true should not have a Card wrapper.
  const hideBorder = allFields.some((f) => f.hide_border && f.fieldtype === 'Section Break');

  // Render columns horizontally as a CSS grid. Each Column Break becomes one
  // grid column. If there are no Column Breaks, fields are in a single column.
  const columns = section.children.filter((c) => c.type === 'column');
  const looseFields = section.children.filter((c) => c.type === 'field');

  // Body: split into N columns when present, else single-column field list.
  const body = (
    <div
      className={cn(
        'grid gap-x-6 gap-y-4',
        columns.length === 0 && 'grid-cols-1',
        columns.length === 1 && 'grid-cols-1',
        columns.length === 2 && (isMobile ? 'grid-cols-1' : 'grid-cols-2'),
        columns.length === 3 && (isMobile ? 'grid-cols-1' : 'grid-cols-3'),
        columns.length === 4 && (isMobile ? 'grid-cols-1' : 'grid-cols-4'),
        columns.length >= 5 && (isMobile ? 'grid-cols-1' : 'grid-cols-5'),
      )}
    >
      {looseFields.map((c) =>
        c.type === 'field' ? (
          <FieldRow
            key={c.field.fieldname}
            field={c.field}
            record={record}
            editable={editable}
            errors={errors}
            onFieldChange={onFieldChange}
            renderTable={renderTable}
            isExistingRecord={isExistingRecord}
            docstatus={docstatus}
            isSubmittable={isSubmittable}
            dynamicRequired={c.field.mandatory_depends_on ? evaluateDependsOn(c.field.mandatory_depends_on, record) : false}
            dynamicReadOnly={c.field.read_only_depends_on ? evaluateDependsOn(c.field.read_only_depends_on, record) : false}
          />
        ) : null,
      )}
      {columns.map((col) => (
        <div key={col.fieldname} className="space-y-4">
          {col.children.map((c) =>
            c.type === 'field' ? (
              <FieldRow
                key={c.field.fieldname}
                field={c.field}
                record={record}
                editable={editable}
                errors={errors}
                onFieldChange={onFieldChange}
                renderTable={renderTable}
                isExistingRecord={isExistingRecord}
                docstatus={docstatus}
                isSubmittable={isSubmittable}
                dynamicRequired={c.field.mandatory_depends_on ? evaluateDependsOn(c.field.mandatory_depends_on, record) : false}
                dynamicReadOnly={c.field.read_only_depends_on ? evaluateDependsOn(c.field.read_only_depends_on, record) : false}
              />
            ) : null,
          )}
        </div>
      ))}
    </div>
  );

  if (section.label) {
    // hide_border: render without Card wrapper, just a labeled section
    if (hideBorder) {
      return (
        <div className="space-y-3">
          <div
            className={cn('flex items-center gap-2', collapsibleHeader && 'cursor-pointer')}
            onClick={() => collapsibleHeader && setOpen((o) => !o)}
          >
            {collapsibleHeader &&
              (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
            <h3 className="text-sm font-semibold">{section.label}</h3>
          </div>
          {open && body}
        </div>
      );
    }

    return (
      <Card>
        <CardHeader
          className={cn('pb-3', collapsibleHeader && 'cursor-pointer')}
          onClick={() => collapsibleHeader && setOpen((o) => !o)}
        >
          <CardTitle className="flex items-center gap-2 text-sm">
            {collapsibleHeader &&
              (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
            {section.label}
          </CardTitle>
        </CardHeader>
        {open && <CardContent>{body}</CardContent>}
      </Card>
    );
  }

  return <div className="space-y-0">{body}</div>;
}

function TabContent(props: {
  tab: Extract<LayoutNode, { type: 'tab' }>;
  record: Record<string, unknown>;
  editable: boolean;
  errors: Record<string, string>;
  onFieldChange: (f: string, v: unknown) => void;
  renderTable?: (field: DocFieldMeta) => JSX.Element;
  isExistingRecord?: boolean;
  docstatus?: number;
  isSubmittable?: boolean;
}): JSX.Element {
  const { tab, ...rest } = props;
  const sections = tab.children.filter((c) => c.type === 'section');
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <SectionBlock key={s.fieldname} section={s} {...rest} />
      ))}
    </div>
  );
}

/**
 * Render the parsed layout tree as Frappe-style tabs + sections + columns.
 * If the tree has no Tab Break nodes, falls back to a flat sections view.
 */
export function ERPTabLayout(props: ERPTabLayoutProps): JSX.Element {
  const { tree, isNew, docstatus, isSubmittable, ...rest } = props;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const tabs = tree.filter((n) => n.type === 'tab') as Extract<LayoutNode, { type: 'tab' }>[];
  const rootSections = tree.filter((n) => n.type === 'section') as Extract<LayoutNode, { type: 'section' }>[];

  const isExistingRecord = !isNew;

  // Shared props to pass down to SectionBlock / TabContent
  const sectionProps = {
    ...rest,
    isExistingRecord,
    docstatus,
    isSubmittable,
  };

  // Frappe convention: when at least one Tab Break exists, fields BEFORE the
  // first Tab Break belong to an implicit "Details" tab. We collect them as
  // top-level sections and prepend a Details tab if there are any.
  let normalizedTabs = tabs;
  if (tabs.length > 0 && rootSections.length > 0) {
    normalizedTabs = [
      {
        type: 'tab',
        fieldname: '__details_tab',
        label: 'Details',
        children: rootSections,
      },
      ...tabs,
    ];
  }

  if (normalizedTabs.length === 0) {
    return (
      <div className="space-y-4">
        {rootSections.map((s) => (
          <SectionBlock key={s.fieldname} section={s} {...sectionProps} />
        ))}
      </div>
    );
  }

  return (
    <Tabs defaultValue={normalizedTabs[0].fieldname}>
      <TabsList className="mb-4 flex w-full flex-wrap justify-start gap-1 bg-gray-100 rounded-xl p-1">
        {normalizedTabs.map((tab) => (
          <TabsTrigger
            key={tab.fieldname}
            value={tab.fieldname}
            className="rounded-lg px-3 py-1.5 text-sm transition-all data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {normalizedTabs.map((tab) => (
        <TabsContent key={tab.fieldname} value={tab.fieldname} className="mt-0 space-y-4">
          <TabContent tab={tab} {...sectionProps} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
