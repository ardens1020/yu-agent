import { yuBoardAdapter } from "./yu-board";
import { joinJobAdapter } from "./join-job";
import { joinProgramAdapter } from "./join-program";
import type { CrawlAdapter } from "./types";

const ADAPTERS: Record<string, CrawlAdapter> = {
  [yuBoardAdapter.key]: yuBoardAdapter,
  [joinJobAdapter.key]: joinJobAdapter,
  [joinProgramAdapter.key]: joinProgramAdapter,
};

export function getAdapter(key: string): CrawlAdapter {
  const adapter = ADAPTERS[key];
  if (!adapter) throw new Error(`알 수 없는 어댑터: ${key}`);
  return adapter;
}

export function adapterKeys(): string[] {
  return Object.keys(ADAPTERS);
}

export * from "./types";
export { contentHash } from "./yu-board";
