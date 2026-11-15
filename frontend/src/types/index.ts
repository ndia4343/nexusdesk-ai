export interface Workspace {
  id: string;
  name: string;
  industry: string;
  icon: string;
  description: string;
  seedPrompts: string[];
  totalChunks?: number;
  hasCatalog?: boolean;
}

export interface ExecutionTraceItem {
  step: string;
  tool: string;
  status: string;
  latency_ms: number;
}

export interface ProductItem {
  name: string;
  category: string;
  price: number;
  discount: string;
  rating: number;
}

export interface SourceItem {
  title: string;
  snippet: string;
  relevance: number;
}

export interface EscalationInfo {
  triggered: boolean;
  ticket_id: string | null;
  n8n_status: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  executionTrace?: ExecutionTraceItem[];
  products?: ProductItem[];
  sources?: SourceItem[];
  confidenceScore?: number;
  escalation?: EscalationInfo;
  workspaceId?: string;
}

export type DrawerContent =
  | { type: "citation"; data: SourceItem }
  | { type: "product"; data: ProductItem }
  | { type: "escalation"; data: { escalation: EscalationInfo; query: string; timestamp: string } }
  | null;
