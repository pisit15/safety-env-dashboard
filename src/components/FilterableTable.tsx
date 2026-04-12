'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Types ───

export interface ColumnDef<T> {
  key: string;
  header: string | React.ReactNode;
  /** Render cell content. Falls back to row[key] */
  render?: (row: T, index: number) => React.ReactNode;
  /** Sort accessor — return a number or string for sorting. If omitted, column is not sortable */
  sortValue?: (row: T) => number | string;
  /** Header alignment */
  headerAlign?: 'left' | 'center' | 'right';
  /** Cell alignment */
  align?: 'left' | 'center' | 'right';
  /** Min-width in px */
  minWidth?: number;
  /** Column width (CSS value) */
  width?: string;
  /** Sticky left position for frozen columns */
  sticky?: boolean;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
  /** Filter predicate — returns true if row passes filter */
  predicate: (row: any, filterValue: string) => boolean;
}

export interface FilterableTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  /** Optional search — provide a function that returns true if row matches query */
  searchable?: (row: T, query: string) => boolean;
  searchPlaceholder?: string;
  /** Optional filter dropdowns */
  filters?: FilterDef[];
  /** Rows per page. Set 0 or omit to disable pagination */
  pageSize?: number;
  /** Default sort key and direction */
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  /** Max height for scroll container (px). Default: 500 */
  maxHeight?: number;
  /** Row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Row style override */
  rowStyle?: (row: T, index: number) => React.CSSProperties;
  /** Row class override */
  rowClassName?: (row: T, index: number) => string;
  /** Empty state message */
  emptyMessage?: string;
  /** Show row count summary */
  showCount?: boolean;
  /** Additional header content (right side) */
  headerExtra?: React.ReactNode;
  /** Table title */
  title?: string;
  /** Compact mode — smaller padding/font */
  compact?: boolean;
}

// ─── Component ───

export function FilterableTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable,
  searchPlaceholder = 'ค้นหา...',
  filters = [],
  pageSize = 0,
  defaultSort,
  maxHeight = 500,
  onRowClick,
  rowStyle,
  rowClassName,
  emptyMessage = 'ไม่มีข้อมูล',
  showCount = true,
  headerExtra,
  title,
  compact = false,
}: FilterableTableProps<T>) {
  // ─── State ───
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    filters.forEach(f => { init[f.key] = ''; });
    return init;
  });
  const [sortKey, setSortKey] = useState(defaultSort?.key || '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSort?.dir || 'asc');
  const [page, setPage] = useState(0);

  // ─── Filter + Search + Sort pipeline ───
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (searchable && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(row => searchable(row, q));
    }

    // Apply filters
    filters.forEach(f => {
      const val = filterValues[f.key];
      if (val) {
        result = result.filter(row => f.predicate(row, val));
      }
    });

    // Apply sort
    if (sortKey) {
      const col = columns.find(c => c.key === sortKey);
      if (col?.sortValue) {
        const accessor = col.sortValue;
        result.sort((a, b) => {
          const va = accessor(a);
          const vb = accessor(b);
          const cmp = typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb));
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return result;
  }, [data, searchQuery, filterValues, sortKey, sortDir, searchable, filters, columns]);

  // Pagination
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filteredData.length / pageSize)) : 1;
  const pagedData = pageSize > 0
    ? filteredData.slice(page * pageSize, (page + 1) * pageSize)
    : filteredData;

  // Reset page when filters change
  const updateFilter = useCallback((key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
    setPage(0);
  }, []);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  }, [sortKey]);

  // ─── Styles ───
  const cellPadding = compact ? '6px 8px' : '10px 12px';
  const fontSize = compact ? 11 : 12;
  const headerFontSize = compact ? 10 : 11;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--card-solid)' }}>
      {/* Toolbar: Title + Search + Filters */}
      {(title || searchable || filters.length > 0 || headerExtra) && (
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
          background: 'var(--bg-secondary)',
        }}>
          {title && (
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginRight: 8 }}>
              {title}
            </span>
          )}
          {searchable && (
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
                placeholder={searchPlaceholder}
                style={{
                  width: '100%', padding: '7px 10px 7px 30px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--card-solid)',
                  fontSize: 12, color: 'var(--text-primary)', outline: 'none',
                }}
              />
            </div>
          )}
          {filters.map(f => (
            <select
              key={f.key}
              value={filterValues[f.key] || ''}
              onChange={e => updateFilter(f.key, e.target.value)}
              style={{
                padding: '7px 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--card-solid)',
                fontSize: 12, color: 'var(--text-primary)', outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">{f.label}</option>
              {f.options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ))}
          {headerExtra}
          {showCount && (
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
              {filteredData.length} รายการ
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ overflow: 'auto', maxHeight }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map(col => {
                const isSortable = !!col.sortValue;
                const isActive = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={isSortable ? () => handleSort(col.key) : undefined}
                    style={{
                      padding: cellPadding,
                      fontSize: headerFontSize,
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      textAlign: col.headerAlign || col.align || 'left',
                      borderBottom: '2px solid var(--border)',
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                      background: 'var(--card-solid)',
                      cursor: isSortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                      minWidth: col.minWidth,
                      width: col.width,
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.header}
                      {isSortable && (
                        isActive
                          ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
                          : <ChevronsUpDown size={12} style={{ opacity: 0.3 }} />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: '32px 14px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedData.map((row, idx) => {
                const globalIdx = pageSize > 0 ? page * pageSize + idx : idx;
                return (
                  <tr
                    key={globalIdx}
                    onClick={onRowClick ? () => onRowClick(row, globalIdx) : undefined}
                    className={rowClassName ? rowClassName(row, globalIdx) : undefined}
                    style={{
                      cursor: onRowClick ? 'pointer' : 'default',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.1s',
                      ...(rowStyle ? rowStyle(row, globalIdx) : {}),
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'; }}
                    onMouseLeave={e => {
                      const custom = rowStyle ? rowStyle(row, globalIdx) : {};
                      (e.currentTarget as HTMLElement).style.background = (custom as any).background || 'transparent';
                    }}
                  >
                    {columns.map(col => (
                      <td
                        key={col.key}
                        style={{
                          padding: cellPadding,
                          fontSize,
                          color: 'var(--text-primary)',
                          textAlign: col.align || 'left',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.render ? col.render(row, globalIdx) : String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      {pageSize > 0 && totalPages > 1 && (
        <div style={{
          padding: '8px 14px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-secondary)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            แสดง {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filteredData.length)} จาก {filteredData.length}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: page === 0 ? 'transparent' : 'var(--card-solid)',
                color: page === 0 ? 'var(--muted)' : 'var(--text-primary)',
                cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '0 8px' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
                background: page >= totalPages - 1 ? 'transparent' : 'var(--card-solid)',
                color: page >= totalPages - 1 ? 'var(--muted)' : 'var(--text-primary)',
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterableTable;
