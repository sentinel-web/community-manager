import { Button, Card, Checkbox, List, Typography } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import type { ExpandableConfig, TableRowSelection } from 'antd/es/table/interface';
import React, { ReactNode, useCallback, useState } from 'react';

interface TableListProps<T> {
  columns?: ColumnsType<T>;
  datasource?: T[];
  expandable?: ExpandableConfig<T>;
  rowSelection?: TableRowSelection<T>;
}

// Resolve a possibly-dotted / array dataIndex against a record. The column
// factories use dotted strings (e.g. 'profile.squadId') purely as keys and read
// from `record` inside `render`, so this is a best-effort fallback for the rare
// column that has no `render`.
function getCellValue<T>(record: T, dataIndex: ColumnType<T>['dataIndex']): unknown {
  if (dataIndex === undefined || dataIndex === null) return undefined;
  const path = Array.isArray(dataIndex) ? dataIndex.map(String) : String(dataIndex).split('.');
  return path.reduce<unknown>((acc, key) => (acc == null ? acc : (acc as Record<string, unknown>)[key]), record);
}

function renderTitle(title: ColumnType<unknown>['title']): ReactNode {
  return typeof title === 'function' ? null : (title as ReactNode);
}

// antd's column `render` may return a `RenderedCell` ({ children, props }) for
// cell-merging instead of a plain node; unwrap it to a renderable child.
function normalizeCell(node: unknown): ReactNode {
  if (node && typeof node === 'object' && !React.isValidElement(node) && !Array.isArray(node) && 'children' in node) {
    return (node as { children?: ReactNode }).children ?? null;
  }
  return node as ReactNode;
}

/**
 * Mobile rendering of a data table: one Card per row, each column shown as a
 * label/value pair reusing the column's own `title` and `render`. Mirrors the
 * desktop Table's selection and row-expand behaviour so feature parity holds
 * below the `md` breakpoint. See the responsive audit (finding #1).
 */
export default function TableList<T extends { _id?: string }>({
  columns = [],
  datasource = [],
  expandable,
  rowSelection,
}: TableListProps<T>) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const selectedKeys = rowSelection?.selectedRowKeys ?? [];

  const toggleSelect = useCallback(
    (record: T, checked: boolean) => {
      if (!rowSelection?.onChange) return;
      const id = record._id as React.Key;
      const next = checked ? [...selectedKeys, id] : selectedKeys.filter(k => k !== id);
      const selectedRows = datasource.filter(r => next.includes(r._id as React.Key));
      rowSelection.onChange(next, selectedRows, { type: 'single' });
    },
    [rowSelection, selectedKeys, datasource]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandedRowRender = expandable?.expandedRowRender;
  const rowExpandable = expandable?.rowExpandable;

  return (
    <List<T>
      dataSource={datasource}
      rowKey={record => record._id ?? ''}
      renderItem={(record, index) => {
        const id = record._id ?? '';
        const canExpand = !!expandedRowRender && (rowExpandable ? rowExpandable(record) : true);
        const isExpanded = expandedKeys.has(id);

        return (
          <List.Item style={{ padding: '8px 0' }}>
            <Card
              size="small"
              style={{ width: '100%' }}
              extra={
                rowSelection ? (
                  <Checkbox
                    checked={selectedKeys.includes(id as React.Key)}
                    onChange={(e: CheckboxChangeEvent) => toggleSelect(record, e.target.checked)}
                  />
                ) : undefined
              }
            >
              {(columns as ColumnType<T>[]).map((col, colIndex) => {
                const value = getCellValue(record, col.dataIndex);
                const content = col.render ? normalizeCell(col.render(value, record, index)) : ((value as ReactNode) ?? '-');
                const key = col.key ?? (col.dataIndex ? String(col.dataIndex) : colIndex);
                return (
                  <div
                    key={String(key)}
                    style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', alignItems: 'baseline' }}
                  >
                    <Typography.Text type="secondary" style={{ flex: '0 0 auto' }}>
                      {renderTitle(col.title as ColumnType<unknown>['title'])}
                    </Typography.Text>
                    <div style={{ textAlign: 'right', minWidth: 0 }}>{content}</div>
                  </div>
                );
              })}
              {canExpand && (
                <>
                  <Button type="link" size="small" style={{ paddingLeft: 0 }} onClick={() => toggleExpand(id)}>
                    {isExpanded ? '−' : '+'}
                  </Button>
                  {isExpanded && <div>{expandedRowRender!(record, index, 0, true)}</div>}
                </>
              )}
            </Card>
          </List.Item>
        );
      }}
    />
  );
}
