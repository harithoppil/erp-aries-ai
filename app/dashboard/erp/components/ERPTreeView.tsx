'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  fetchDoctypeTree,
  rebuildNestedSet,
  type TreeNode,
} from '@/app/dashboard/erp/[doctype]/tree-actions';
import { useRouter } from 'next/navigation';

interface ERPTreeViewProps {
  doctype: string;
  labelField?: string;
  parentField?: string;
  isGroupField?: string;
  title?: string;
  filters?: Record<string, unknown>;
}

function TreeNodeRow({
  node,
  depth,
  onNavigate,
}: {
  node: TreeNode;
  depth: number;
  onNavigate: (node: TreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-2 hover:bg-muted/50 cursor-pointer rounded-sm text-sm"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onNavigate(node)}
      >
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-muted rounded"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        {node.isGroup ? (
          expanded ? <FolderOpen className="h-4 w-4 text-amber-500" /> : <Folder className="h-4 w-4 text-amber-500" />
        ) : (
          <File className="h-4 w-4 text-gray-400" />
        )}
        <span className="truncate flex-1">{node.label}</span>
        {node.isGroup && (
          <Badge variant="outline" className="text-[9px] h-4">Group</Badge>
        )}
      </div>
      {expanded && hasChildren && node.children.map((child) => (
        <TreeNodeRow key={child.name} node={child} depth={depth + 1} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export default function ERPTreeView({
  doctype,
  labelField,
  parentField,
  isGroupField,
  title,
  filters,
}: ERPTreeViewProps) {
  const router = useRouter();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadTree = useCallback(() => {
    startTransition(async () => {
      const result = await fetchDoctypeTree(doctype, {
        labelField,
        parentField,
        isGroupField,
        filters,
      });
      if (result.success && result.tree) {
        setTree(result.tree);
        setError(null);
      } else {
        setError(result.error ?? 'Failed to load tree');
      }
    });
  }, [doctype, labelField, parentField, isGroupField, filters]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const handleRebuild = () => {
    startTransition(async () => {
      const result = await rebuildNestedSet(doctype, parentField);
      if (result.success) {
        toast.success('Tree structure rebuilt');
        loadTree();
      } else {
        toast.error(result.error ?? 'Failed to rebuild tree');
      }
    });
  };

  const handleNavigate = (node: TreeNode) => {
    router.push(`/dashboard/erp/${doctype}/${encodeURIComponent(node.name)}`);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title ?? `${doctype} Tree`}</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleRebuild} disabled={pending}>
            <RefreshCw className="mr-1 h-3 w-3" /> Rebuild
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {pending && tree.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-red-500">{error}</div>
        ) : tree.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No records found</div>
        ) : (
          <div className="space-y-0">
            {tree.map((node) => (
              <TreeNodeRow key={node.name} node={node} depth={0} onNavigate={handleNavigate} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}