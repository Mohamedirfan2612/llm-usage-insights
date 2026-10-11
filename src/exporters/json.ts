import type {
  AllFeaturesReport,
  AllUsersReport,
  ExportOptions,
  ModelReport,
  UsageRecord
} from '../types.js';

export type JsonExportTarget = UsageRecord[] | ModelReport | AllUsersReport | AllFeaturesReport;

/**
 * Exports data structures to a valid JSON string.
 */
export function exportToJSON(
  data: JsonExportTarget,
  options?: Pick<ExportOptions, 'pretty'>
): string {
  const indent = options?.pretty ? 2 : undefined;
  return JSON.stringify(data, null, indent);
}
