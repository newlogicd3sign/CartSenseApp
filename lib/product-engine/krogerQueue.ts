// lib/product-engine/krogerQueue.ts
// Request queue with concurrency control for Kroger API calls
import "server-only";
import { KROGER_RATE_LIMITS, QUEUE_PRIORITY } from "./krogerConfig";

type QueuedTask = {
  id: string;
  priority: number;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  createdAt: number;
  timeoutMs: number;
};

class KrogerRequestQueue {
  private queue: QueuedTask[] = [];
  private activeCount = 0;
  private maxConcurrent: number;
  private taskIdCounter = 0;
  private isPaused = false;
  private pauseUntil = 0;

  constructor(maxConcurrent = KROGER_RATE_LIMITS.MAX_CONCURRENT_REQUESTS) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a task to the queue with priority
   * Higher priority tasks are processed first
   */
  async enqueue<T>(
    execute: () => Promise<T>,
    priority: number = QUEUE_PRIORITY.ENRICH,
    timeoutMs: number = KROGER_RATE_LIMITS.QUEUE_TIMEOUT_MS
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: QueuedTask = {
        id: `kroger-${++this.taskIdCounter}`,
        priority,
        execute: execute as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        createdAt: Date.now(),
        timeoutMs,
      };

      // Insert in priority order (higher priority first)
      const insertIndex = this.queue.findIndex((t) => t.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(task);
      } else {
        this.queue.splice(insertIndex, 0, task);
      }

      this.logQueueStatus("enqueue", task.id);
      this.processNext();
    });
  }

  /**
   * Pause all queue processing (used when 429 detected)
   */
  pause(durationMs: number = KROGER_RATE_LIMITS.RATE_LIMIT_PAUSE_MS): void {
    this.isPaused = true;
    this.pauseUntil = Date.now() + durationMs;
    console.log(`🚫 Kroger queue PAUSED for ${durationMs / 1000}s due to rate limit`);

    setTimeout(() => {
      this.resume();
    }, durationMs);
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    if (this.isPaused && Date.now() >= this.pauseUntil) {
      this.isPaused = false;
      console.log("✅ Kroger queue RESUMED");
      this.processNext();
    }
  }

  /**
   * Process next task in queue if capacity available
   */
  private async processNext(): Promise<void> {
    // Check if paused
    if (this.isPaused) {
      return;
    }

    // Check if at capacity
    if (this.activeCount >= this.maxConcurrent) {
      return;
    }

    // Get next task
    const task = this.queue.shift();
    if (!task) {
      return;
    }

    // Check for timeout before processing
    const waitTime = Date.now() - task.createdAt;
    if (waitTime > task.timeoutMs) {
      task.reject(new Error(`Queue timeout after ${waitTime}ms`));
      this.logQueueStatus("timeout", task.id);
      this.processNext();
      return;
    }

    // Execute task
    this.activeCount++;
    this.logQueueStatus("start", task.id);

    try {
      const result = await task.execute();
      task.resolve(result);
      this.logQueueStatus("complete", task.id);
    } catch (error) {
      task.reject(error instanceof Error ? error : new Error(String(error)));
      this.logQueueStatus("error", task.id);
    } finally {
      this.activeCount--;
      // Process next task after small delay to avoid thundering herd
      setTimeout(() => this.processNext(), 50);
    }
  }

  /**
   * Get current queue statistics
   */
  getStats(): {
    queueLength: number;
    activeCount: number;
    isPaused: boolean;
    pauseRemainingMs: number;
  } {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeCount,
      isPaused: this.isPaused,
      pauseRemainingMs: this.isPaused ? Math.max(0, this.pauseUntil - Date.now()) : 0,
    };
  }

  /**
   * Clear all pending tasks (with rejection)
   */
  clear(): void {
    const count = this.queue.length;
    this.queue.forEach((task) => {
      task.reject(new Error("Queue cleared"));
    });
    this.queue = [];
    console.log(`🗑️ Kroger queue cleared (${count} tasks)`);
  }

  private logQueueStatus(action: string, taskId: string): void {
    const stats = this.getStats();
    console.log(
      `📋 Kroger Queue [${action}] ${taskId} | active: ${stats.activeCount}/${this.maxConcurrent} | queued: ${stats.queueLength}${stats.isPaused ? " | PAUSED" : ""}`
    );
  }
}

// Singleton instance
let queueInstance: KrogerRequestQueue | null = null;

export function getKrogerQueue(): KrogerRequestQueue {
  if (!queueInstance) {
    queueInstance = new KrogerRequestQueue();
  }
  return queueInstance;
}

/**
 * Helper function to queue a Kroger API request
 */
export async function queueKrogerRequest<T>(
  execute: () => Promise<T>,
  priority: number = QUEUE_PRIORITY.ENRICH
): Promise<T> {
  return getKrogerQueue().enqueue(execute, priority);
}

/**
 * Pause the queue (called when 429 detected)
 */
export function pauseKrogerQueue(durationMs?: number): void {
  getKrogerQueue().pause(durationMs);
}

/**
 * Get queue statistics
 */
export function getKrogerQueueStats() {
  return getKrogerQueue().getStats();
}

/**
 * Process items in chunks through the queue
 * Useful for batch operations like enriching many ingredients
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  chunkSize: number = KROGER_RATE_LIMITS.MAX_CONCURRENT_REQUESTS,
  priority: number = QUEUE_PRIORITY.ENRICH
): Promise<{ results: R[]; errors: Array<{ index: number; error: Error }> }> {
  const results: R[] = [];
  const errors: Array<{ index: number; error: Error }> = [];

  // Process in chunks
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(async (item, chunkIndex) => {
      const globalIndex = i + chunkIndex;
      try {
        const result = await queueKrogerRequest(() => processor(item), priority);
        return { index: globalIndex, result, error: null };
      } catch (error) {
        return {
          index: globalIndex,
          result: null,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);

    for (const { index, result, error } of chunkResults) {
      if (error) {
        errors.push({ index, error });
      } else if (result !== null) {
        results[index] = result;
      }
    }
  }

  return { results, errors };
}
