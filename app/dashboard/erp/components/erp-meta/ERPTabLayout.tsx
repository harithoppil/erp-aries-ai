'use client';

import { type JSX, useState } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ERPFieldRenderer } from './ERPFieldRenderer';
import type {
  DocFieldMeta,
  LayoutNode,
} from '@/lib/erpnext/doctype-meta';

interface ERPTabLayoutProps {
  tree: LayoutNode[];
  record: Record<string, unknown>;
  editable: boolean;
  errors: Record<string, string>;
  onFieldChange: (fieldname: string, value: unknown) => void;
  /** Render slot for Table-type fields. Caller controls the grid. */
  renderTable?: (field: DocFieldMeta) => JSX.Element;
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
}): JSX.Element | null {
  const { field, record, editable, errors, onFieldChange, renderTable } = props;
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

  return (
    <div className="space-y-1">
      <label htmlFor={field.fieldname} className="block text-sm font-medium">
        {field.label || field.fieldname}
        {field.reqd && <span className="text-red-500"> *</span>}
      </label>
      <ERPFieldRenderer
        field={field}
        value={record[field.fieldname]}
        editable={editable}
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
}): JSX.Element | null {
  const { section, record, editable, errors, onFieldChange, renderTable } = props;
  const allFields = nodeFields(section);
  if (allFields.length === 0) return null;

  const [open, setOpen] = useState(true);
  const collapsibleHeader = section.collapsible && section.label;

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
        columns.length === 2 && 'grid-cols-1 md:grid-cols-2',
        columns.length === 3 && 'grid-cols-1 md:grid-cols-3',
        columns.length >= 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
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
              />
            ) : null,
          )}
        </div>
      ))}
    </div>
  );

  if (section.label) {
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
  const { tree, ...rest } = props;
  const tabs = tree.filter((n) => n.type === 'tab') as Extract<LayoutNode, { type: 'tab' }>[];
  const rootSections = tree.filter((n) => n.type === 'section') as Extract<LayoutNode, { type: 'section' }>[];

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
          <SectionBlock key={s.fieldname} section={s} {...rest} />
        ))}
      </div>
    );
  }

  return (
    <Tabs defaultValue={normalizedTabs[0].fieldname}>
      <TabsList className="mb-4 flex w-full flex-wrap justify-start gap-1 bg-transparent p-0">
        {normalizedTabs.map((tab) => (
          <TabsTrigger
            key={tab.fieldname}
            value={tab.fieldname}
            className="rounded-md border border-transparent px-3 py-1.5 text-sm data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {normalizedTabs.map((tab) => (
        <TabsContent key={tab.fieldname} value={tab.fieldname} className="mt-0 space-y-4">
          <TabContent tab={tab} {...rest} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
