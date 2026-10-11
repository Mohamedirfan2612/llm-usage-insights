import type { RecordFilter, UsageRecord } from '../types.js';
import type { StorageAdapter } from './storage-interface.js';

/**
 * Parses and normalizes date boundaries for filtering.
 */
export function normalizeDateBoundary(
  dateInput: Date | string | undefined,
  isEndOfDay: boolean = false
): number | null {
  if (!dateInput) return null;

  if (typeof dateInput === 'string') {
    // If string is YYYY-MM-DD format and isEndOfDay is true, make it end of day
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      const suffix = isEndOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
      return new Date(`${dateInput.trim()}${suffix}`).getTime();
    }
    const parsed = new Date(dateInput).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (dateInput instanceof Date) {
    return dateInput.getTime();
  }

  return null;
}

/**
 * High-performance in-memory storage adapter.
 *
 * NOTE: In-memory data is ephemeral and does not persist across process restarts
 * or provide multi-process/cluster distributed synchronization.
 */
export class MemoryStore implements StorageAdapter {
  private records: UsageRecord[] = [];

  /**
   * Save a usage record in memory.
   */
  public record(entry: UsageRecord): void {
    this.records.push({ ...entry });
  }

  /**
   * Filter and return records based on filter criteria.
   */
  public getRecords(filter?: RecordFilter): UsageRecord[] {
    if (!filter) {
      return [...this.records];
    }

    const fromMs = normalizeDateBoundary(filter.from, false);
    const inclusive = filter.inclusiveEndDate !== false; // default true
    const toMs = normalizeDateBoundary(filter.to, inclusive);

    const normProvider = filter.provider?.trim().toLowerCase();
    const normModel = filter.model?.trim().toLowerCase();

    return this.records.filter((rec) => {
      const recTime = rec.timestamp.getTime();

      if (fromMs !== null && recTime < fromMs) {
        return false;
      }

      if (toMs !== null) {
        if (inclusive && recTime > toMs) return false;
        if (!inclusive && recTime >= toMs) return false;
      }

      if (normProvider && rec.provider.toLowerCase() !== normProvider) {
        return false;
      }

      if (normModel && rec.model.toLowerCase() !== normModel) {
        return false;
      }

      if (filter.userId !== undefined && rec.userId !== filter.userId) {
        return false;
      }

      if (filter.feature !== undefined && rec.feature !== filter.feature) {
        return false;
      }

      if (filter.status !== undefined && rec.status !== filter.status) {
        return false;
      }

      return true;
    });
  }

  /**
   * Clear all records.
   */
  public clear(): void {
    this.records = [];
  }

  /**
   * Count records matching filter.
   */
  public count(filter?: RecordFilter): number {
    return this.getRecords(filter).length;
  }
}
