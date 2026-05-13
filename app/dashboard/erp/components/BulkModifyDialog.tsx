'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { bulkUpdateDoctypeRecords, type BulkResult } from '@/app/dashboard/erp/[doctype]/actions';
import type { DocFieldMeta } from '@/lib/erpnext/doctype-meta';

interface BulkModifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctype: string;
  selectedNames: string[];
  fields: DocFieldMeta[];
  onDone: () => void;
}

export default function BulkModifyDialog({
  open,
  onOpenChange,
  doctype,
  selectedNames,
  fields,
  onDone,
}: BulkModifyDialogProps) {
  const [pending, startTransition] = useTransition();
  const [selectedField, setSelectedField] = useState('');
  const [newValue, setNewValue] = useState('');

  // Filter to editable fields (exclude name, status, timestamps, read-only)
  const editableFields = fields.filter((f) => {
    if (f.fieldname === 'name' || f.fieldname === 'docstatus') return false;
    if (f.fieldtype === 'Section Break' || f.fieldtype === 'Column Break' || f.fieldtype === 'HTML') return false;
    if (f.read_only) return false;
    return true;
  });

  const selectedFieldMeta = editableFields.find((f) => f.fieldname === selectedField);

  const handleSubmit = () => {
    if (!selectedField || !newValue) {
      toast.error('Select a field and enter a value');
      return;
    }

    startTransition(async () => {
      // Type coerce the value based on field type
      let coercedValue: unknown = newValue;
      if (selectedFieldMeta) {
        if (selectedFieldMeta.fieldtype === 'Int') coercedValue = parseInt(newValue, 10);
        else if (selectedFieldMeta.fieldtype === 'Float' || selectedFieldMeta.fieldtype === 'Currency') coercedValue = parseFloat(newValue);
        else if (selectedFieldMeta.fieldtype === 'Check') coercedValue = newValue === '1' || newValue.toLowerCase() === 'true';
        else if (selectedFieldMeta.fieldtype === 'Date') coercedValue = new Date(newValue).toISOString();
      }

      const result: BulkResult = await bulkUpdateDoctypeRecords(doctype, selectedNames, {
        [selectedField]: coercedValue,
      });

      if (result.success) {
        toast.success(`${result.affected} record(s) updated`);
        if (result.failed > 0) {
          toast.warning(`${result.failed} record(s) could not be updated`);
        }
        setSelectedField('');
        setNewValue('');
        onOpenChange(false);
        onDone();
      } else {
        toast.error(result.errors?.[0] || 'Bulk update failed');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Modify</DialogTitle>
          <DialogDescription>
            Update a field value for {selectedNames.length} selected record(s).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Field to Update</label>
            <Select value={selectedField} onValueChange={(v) => { if (v !== null) { setSelectedField(v); setNewValue(''); } }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a field..." />
              </SelectTrigger>
              <SelectContent>
                {editableFields.map((f) => (
                  <SelectItem key={f.fieldname} value={f.fieldname}>
                    {f.label || f.fieldname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedField && (
            <div>
              <label className="text-sm font-medium">
                New Value {selectedFieldMeta && (
                  <span className="text-muted-foreground">({selectedFieldMeta.fieldtype})</span>
                )}
              </label>
              {selectedFieldMeta?.fieldtype === 'Check' ? (
                <Select value={newValue} onValueChange={(v) => { if (v !== null) setNewValue(v); }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Yes (Checked)</SelectItem>
                    <SelectItem value="0">No (Unchecked)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="mt-1"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={
                    selectedFieldMeta?.fieldtype === 'Int' ? 'Enter number...'
                    : selectedFieldMeta?.fieldtype === 'Float' || selectedFieldMeta?.fieldtype === 'Currency' ? 'Enter decimal...'
                    : selectedFieldMeta?.fieldtype === 'Date' ? 'YYYY-MM-DD'
                    : 'Enter new value...'
                  }
                  type={selectedFieldMeta?.fieldtype === 'Int' || selectedFieldMeta?.fieldtype === 'Float' || selectedFieldMeta?.fieldtype === 'Currency' ? 'number' : 'text'}
                />
              )}
            </div>
          )}

          <Button onClick={handleSubmit} disabled={pending || !selectedField || !newValue} className="w-full">
            {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : <><Pencil className="mr-2 h-4 w-4" />Update {selectedNames.length} Records</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}