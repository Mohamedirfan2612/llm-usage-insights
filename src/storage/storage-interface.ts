import type { RecordFilter, UsageRecord } from '../types.js';

/**
 * Interface that all storage backends must implement.
 * Can be synchronous or asynchronous.
 */
export interface StorageAdapter {
  /**
   * Save a usage record into the store.
   */
  record(entry: UsageRecord): Promise<void> | void;

  /**
   * Retrieve records matching the specified filter criteria.
   */
  getRecords(filter?: RecordFilter): Promise<UsageRecord[]> | UsageRecord[];

  /**
   * Clear all records from the store.
   */
  clear(): Promise<void> | void;

  /**
   * Count records matching the specified filter criteria.
   */
  count(filter?: RecordFilter): Promise<number> | number;
}
