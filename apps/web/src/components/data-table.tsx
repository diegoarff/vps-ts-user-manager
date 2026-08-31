import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vps-ts-user-manager/ui/components/table";
import { cn } from "@vps-ts-user-manager/ui/lib/utils";

export interface DataTableColumn<T> {
  /** Stable column id. */
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** Appended to the header cell, e.g. "w-36", "label-mono". */
  headerClassName?: string;
  /** Appended to every body cell, e.g. "font-mono text-xs". */
  cellClassName?: string;
  /** Right-aligns the header and cells for numeric/action columns. */
  align?: "left" | "right";
}

/**
 * Read-only table on top of the shadcn Table primitives.
 *
 * The table-fixed layout plus wrap-friendly cells keep long mono strings
 * (domains, filenames, comma-joined lists) inside their columns instead of
 * pushing the table past its container. The outer container is a horizontal
 * scroll element, so a very wide table scrolls internally and never causes
 * page-level horizontal scroll.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyText = "No data",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyText?: string;
}) {
  return (
    <div className="min-w-0 w-full overflow-x-auto rounded-md border">
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.id}
                className={cn(
                  "label-mono",
                  col.align === "right" && "text-right",
                  col.headerClassName,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-16 text-center whitespace-normal text-muted-foreground"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={getRowKey(row)}>
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      "whitespace-normal break-words align-middle",
                      col.align === "right" && "text-right",
                      col.cellClassName,
                    )}
                  >
                    {col.cell(row, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
