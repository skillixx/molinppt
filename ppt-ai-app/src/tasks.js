import { randomUUID } from "node:crypto";
import { AppError } from "./errors.js";
import { requirePermission } from "./permissions.js";

/**
 * In-memory task center for asynchronous framework tasks.
 */
export class MemoryTaskCenter {
  /** Creates an empty task center. */
  constructor() {
    this.tasks = new Map();
  }

  /**
   * Creates a queued task.
   * @param {{ownerUserId: number, type: string, input: object}} input
   * @returns {Promise<object>}
   */
  async createTask({ ownerUserId, type, input }) {
    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      ownerUserId,
      type,
      input,
      status: "queued",
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Updates an existing task.
   * @param {string} taskId
   * @param {object} changes
   * @returns {Promise<object>}
   */
  async updateTask(taskId, changes) {
    const task = this.tasks.get(taskId);
    if (!task) throw new AppError({ code: "TASK_NOT_FOUND", status: 404, message: "Task not found" });
    const updated = { ...task, ...changes, updatedAt: new Date().toISOString() };
    this.tasks.set(taskId, updated);
    return updated;
  }

  /**
   * Returns a task after owner permission validation.
   * @param {string} taskId
   * @param {number} ownerUserId
   * @returns {Promise<object>}
   */
  async getTask(taskId, ownerUserId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new AppError({ code: "TASK_NOT_FOUND", status: 404, message: "Task not found" });
    requirePermission({
      actor: { userId: ownerUserId, role: "user" },
      resource: { ownerUserId: task.ownerUserId },
      action: "read",
    });
    return task;
  }
}
