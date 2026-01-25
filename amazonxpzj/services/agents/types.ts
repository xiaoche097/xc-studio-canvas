export interface AgentTask {
  task_id: string;
  task_type: string;
  task_name: string;
  agent: 'orchestrator' | 'keyword_agent' | 'product_agent' | 'market_agent' | 'report_agent';
  description: string;
  priority: number;
  depends_on: string[];
  params: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

export interface AgentPlan {
  plan_id: string;
  total_tasks: number;
  estimated_time: string;
  tasks: AgentTask[];
}

export interface AgentResponse {
  task_id: string;
  status: 'completed' | 'failed';
  execution_time: string;
  result: any;
}
