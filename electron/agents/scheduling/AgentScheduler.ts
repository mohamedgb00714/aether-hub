import * as cron from 'node-cron';
import type { AgentManager } from '../core/AgentManager.js';
import { createAgentTaskHistory, getAgentTasks, updateAgentTask, updateAgentTaskHistory } from '../../database.js';

export class AgentScheduler {
  private tasks = new Map<string, cron.ScheduledTask>();

  constructor(private agentManager: AgentManager) {}

  async loadSchedules(): Promise<void> {
    this.tasks.forEach(task => task.stop());
    this.tasks.clear();

    const tasks = getAgentTasks();
    tasks.forEach(task => {
      if (task.enabled !== 1 || !task.cron_expression) return;
      this.scheduleTask(task.id, task.cron_expression, task.agent_id, task.task);
    });
  }

  scheduleTask(taskId: string, cronExpression: string, agentId: string, task: string): void {
    this.unscheduleTask(taskId);

    if (!cron.validate(cronExpression)) {
      console.warn(`Invalid cron for task ${taskId}: ${cronExpression}`);
      return;
    }

    const scheduled = cron.schedule(cronExpression, async () => {
      const startedAt = new Date().toISOString();
      const historyId = createAgentTaskHistory({
        task_id: taskId,
        agent_id: agentId,
        status: 'running',
        started_at: startedAt,
        completed_at: null,
        duration_ms: null,
        result: null,
        error_message: null,
        screenshot_path: null,
        html_snapshot: null,
        ai_summary: null
      });

      try {
        const result = await this.agentManager.runTask(agentId, task);
        updateAgentTask(taskId, {
          last_run: new Date().toISOString(),
          last_status: result.status === 'completed' ? 'success' : 'failed'
        });
        updateAgentTaskHistory(historyId, {
          status: result.status === 'completed' ? 'success' : 'failed',
          completed_at: new Date().toISOString(),
          result: result.output ? JSON.stringify(result.output) : null,
          error_message: result.error || null
        });
      } catch (error: any) {
        updateAgentTask(taskId, {
          last_run: new Date().toISOString(),
          last_status: 'failed'
        });
        updateAgentTaskHistory(historyId, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message || 'Task failed'
        });
      }
    });

    this.tasks.set(taskId, scheduled);
  }

  unscheduleTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.stop();
      this.tasks.delete(taskId);
    }
  }

  async runNow(taskId: string): Promise<void> {
    const task = getAgentTasks().find(item => item.id === taskId);
    if (!task) throw new Error('Task not found');

    await this.agentManager.runTask(task.agent_id, task.task);
  }
}
