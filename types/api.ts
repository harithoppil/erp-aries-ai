// Auto-generated from Python Pydantic schemas
// Run: python scripts/generate_types.py
// DO NOT EDIT MANUALLY — changes will be overwritten

export type EnquiryStatus = "draft" | "ingested" | "classified" | "rules_applied" | "llm_drafted" | "policy_review" | "human_review" | "approved" | "executing" | "completed" | "rejected";

export const STATUS_COLORS: Record<EnquiryStatus, string> = {
  "draft": "bg-muted/50 text-muted-foreground",
  "ingested": "bg-primary/10 text-primary",
  "classified": "bg-primary/15 text-primary",
  "rules_applied": "bg-sonar/10 text-sonar",
  "llm_drafted": "bg-amber/10 text-amber",
  "policy_review": "bg-primary/20 text-primary",
  "human_review": "bg-destructive/10 text-destructive",
  "approved": "bg-primary/15 text-primary",
  "executing": "bg-sonar/15 text-sonar",
  "completed": "bg-primary/20 text-primary",
  "rejected": "bg-destructive/15 text-destructive",
};

export interface EnquiryCreate {
  client_name: string;
  client_email?: string | null;
  channel?: string;
  industry?: string | null;
  subdivision?: string | null;
  description: string;
}

export interface EnquiryRead {
  id: string;
  enquiry_number: string | null;
  client_name: string;
  client_email: string | null;
  channel: string;
  industry: string | null;
  subdivision: string | null;
  description: string;
  status: EnquiryStatus;
  estimated_value: unknown | null;
  estimated_cost: unknown | null;
  estimated_margin: unknown | null;
  scope_category: string | null;
  complexity: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnquiryUpdate {
  client_name?: string | null;
  client_email?: string | null;
  industry?: string | null;
  subdivision?: string | null;
  description?: string | null;
  estimated_value?: unknown | null;
  estimated_cost?: unknown | null;
  status?: unknown | null;
  approved_by?: string | null;
}

export interface DocumentRead {
  id: string;
  enquiry_id: string;
  filename: string;
  content_type: string;
  storage_path: string;
  wiki_source_page: string | null;
  processing_status: string;
  created_at: string;
}

export interface WikiPageRead {
  path: string;
  content: string;
  last_modified?: string | null;
  last_commit?: string | null;
}

export interface WikiSearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export interface RAGSearchResult {
  content: string;
  score: number;
  source_path: string | null;
  heading: string | null;
  method: string | null;
  modality: string | null;
  route: string;
}

export interface RAGStats {
  [route: string]: {
    total_chunks: number;
    modalities: Record<string, number>;
  };
}

export interface PipelineRunRequest {
  enquiry_id: string;
}

export interface PipelineRunResponse {
  enquiry_id: string;
  status: string;
  message: string;
  wiki_pages_created?: string[];
  rules_output?: unknown | null;
  llm_draft?: string | null;
}
