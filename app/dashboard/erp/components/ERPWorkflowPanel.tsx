'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from 'sonner';
import { GitBranch, CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import {
  getAvailableTransitions,
  applyWorkflowTransition,
  type WorkflowTransitionInfo,
  type WorkflowInfo,
} from '@/app/dashboard/erp/workflow-actions';

interface ERPWorkflowPanelProps {
  doctype: string;
  recordName: string;
  onTransitionApplied?: () => void;
}

function WorkflowSkeleton(): JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ERPWorkflowPanel({ doctype, recordName, onTransitionApplied }: ERPWorkflowPanelProps): JSX.Element {
  const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null);
  const [transitions, setTransitions] = useState<WorkflowTransitionInfo[]>([]);
  const [currentState, setCurrentState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const loadWorkflow = useCallback(async () => {
    setLoading(true);
    const result = await getAvailableTransitions(doctype, recordName);
    if (result.success) {
      setWorkflow(result.workflow ?? null);
      setTransitions(result.nextActions ?? []);
      setCurrentState(result.currentState ?? null);
    }
    setLoading(false);
  }, [doctype, recordName]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  const handleTransition = useCallback(async (transition: WorkflowTransitionInfo) => {
    setApplying(transition.name);
    const result = await applyWorkflowTransition(doctype, recordName, transition.name);
    if (result.success) {
      toast.success(`${transition.action} → ${transition.nextState}`);
      setTransitions(result.nextActions ?? []);
      setCurrentState(result.currentState ?? transition.nextState);
      onTransitionApplied?.();
    } else {
      toast.error(result.error ?? 'Transition failed');
    }
    setApplying(null);
  }, [doctype, recordName, onTransitionApplied]);

  if (loading) {
    return <WorkflowSkeleton />;
  }

  if (!workflow) {
    return <></>;
  }

  const currentStateInfo = workflow.states.find((s) => s.state === currentState);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5" />
          {workflow.workflowName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current State */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Current:</span>
          <Badge
            variant={
              currentStateInfo?.docStatus === 1 ? 'default' :
              currentStateInfo?.docStatus === 2 ? 'destructive' :
              'secondary'
            }
            className="text-xs"
          >
            {currentState ?? 'Unknown'}
          </Badge>
        </div>

        {/* State message */}
        {currentStateInfo?.message && (
          <p className="text-xs text-muted-foreground italic">{currentStateInfo.message}</p>
        )}

        {/* Workflow state progress */}
        <div className="flex items-center gap-1 flex-wrap">
          {workflow.states.filter((s) => !s.isOptional).map((s, i) => (
            <div key={s.state} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/40" />}
              <Badge
                variant={s.state === currentState ? 'outline' : 'secondary'}
                className={`text-[10px] ${
                  s.state === currentState ? 'ring-2 ring-blue-400' : ''
                }`}
              >
                {s.state}
              </Badge>
            </div>
          ))}
        </div>

        {/* Available Actions */}
        {transitions.length > 0 && (
          <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-2`}>
            {transitions.map((t) => (
              <Button
                key={t.name}
                size="sm"
                variant={
                  t.action.toLowerCase().includes('reject') ? 'destructive' :
                  t.action.toLowerCase().includes('approve') ? 'default' :
                  'outline'
                }
                className="h-7 text-xs"
                disabled={applying !== null}
                onClick={() => handleTransition(t)}
              >
                {applying === t.name ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : t.action.toLowerCase().includes('approve') ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : t.action.toLowerCase().includes('reject') ? (
                  <XCircle className="h-3 w-3 mr-1" />
                ) : null}
                {t.action}
              </Button>
            ))}
          </div>
        )}

        {transitions.length === 0 && currentState && (
          <p className="text-xs text-muted-foreground">
            {currentStateInfo?.docStatus === 1 ? 'Document is approved' :
             currentStateInfo?.docStatus === 2 ? 'Document is cancelled' :
             'No further actions available'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
