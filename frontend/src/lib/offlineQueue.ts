/** Offline action queue using IndexedDB (idb-keyval). */

import { get, set } from "idb-keyval";

export type QueuedAction = {
  id: string;
  path: string;
  method: string;
  body?: unknown;
  createdAt: string;
};

const QUEUE_KEY = "rm_offline_queue";
const ROUTE_CACHE_KEY = "rm_active_route";

async function readQueue(): Promise<QueuedAction[]> {
  return (await get<QueuedAction[]>(QUEUE_KEY)) ?? [];
}

async function writeQueue(items: QueuedAction[]): Promise<void> {
  await set(QUEUE_KEY, items);
}

export async function enqueueAction(
  path: string,
  method: string,
  body?: unknown,
): Promise<number> {
  const q = await readQueue();
  q.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path,
    method,
    body,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(q);
  return q.length;
}

export async function queueLength(): Promise<number> {
  return (await readQueue()).length;
}

export async function cacheActiveRoute(route: unknown): Promise<void> {
  await set(ROUTE_CACHE_KEY, route);
}

export async function getCachedRoute<T>(): Promise<T | undefined> {
  return get<T>(ROUTE_CACHE_KEY);
}

export async function flushQueue(
  send: (path: string, method: string, body?: unknown) => Promise<void>,
): Promise<number> {
  const q = await readQueue();
  if (q.length === 0) return 0;
  const remaining: QueuedAction[] = [];
  let synced = 0;
  for (const item of q) {
    try {
      await send(item.path, item.method, item.body);
      synced += 1;
    } catch {
      remaining.push(item);
      // keep order — stop on first failure to avoid out-of-order completes
      remaining.push(...q.slice(q.indexOf(item) + 1));
      break;
    }
  }
  await writeQueue(remaining);
  return synced;
}
