/**
 * Shared chart utilities for EASHE Safety & Environment Dashboard
 * Solves the problem of charts showing 12 months when only 3-4 have data.
 */

export const MONTH_LABELS_TH = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const;

export const MONTH_LABELS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Trim empty trailing months from chart data arrays.
 *
 * - Keeps all months that have data (any non-zero value in the specified keys)
 * - Adds up to 2 "future" months after the last month with data for context
 * - Always returns at least the first 4 months to avoid overly sparse charts
 * - Returns the original array if more than 10 months have data
 *
 * @param data - Array of month data objects (must be ordered Jan→Dec)
 * @param valueKeys - Keys to check for non-zero values
 * @returns Trimmed array
 */
export function trimEmptyMonths<T extends Record<string, unknown>>(
  data: T[],
  valueKeys: string[],
): T[] {
  if (!data.length) return data;

  // Find the last index that has any non-zero data
  let lastDataIndex = -1;
  for (let i = data.length - 1; i >= 0; i--) {
    const hasData = valueKeys.some((key) => {
      const val = data[i][key];
      return typeof val === 'number' ? val > 0 : !!val;
    });
    if (hasData) {
      lastDataIndex = i;
      break;
    }
  }

  // If no data found, return minimum 4 months
  if (lastDataIndex === -1) {
    return data.slice(0, Math.min(4, data.length));
  }

  // If most months have data, return all
  if (lastDataIndex >= 9) return data;

  // Show up to 2 months after the last data month, minimum 4 months
  const endIndex = Math.min(lastDataIndex + 3, data.length);
  const minIndex = Math.min(4, data.length);
  return data.slice(0, Math.max(endIndex, minIndex));
}
