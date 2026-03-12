import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { SkeletonRows } from "./skeleton-rows";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  totalCount?: number;
  isLoading?: boolean;
  // Pagination can be from URL search params
  pageSize?: number;
  page?: number;
  sort?: string;
  dir?: "asc" | "desc";
}

export function DataTable<TData>({
  columns,
  data,
  totalCount,
  isLoading,
  pageSize = 25,
  page = 1,
  sort,
  dir = "desc",
}: DataTableProps<TData>) {
  const navigate = useNavigate();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : undefined;

  const updateSearch = (updates: Record<string, unknown>) => {
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...updates,
      }),
      replace: true,
    } as any);
  };

  const handleSort = (columnId: string) => {
    if (sort === columnId) {
      updateSearch({ dir: dir === "asc" ? "desc" : "asc" });
    } else {
      updateSearch({ sort: columnId, dir: "desc", page: 1 });
    }
  };

  const SortIcon = ({ columnId }: { columnId: string }) => {
    if (sort !== columnId) return <ArrowUpDown className="ml-1 h-3 w-3" />;
    return dir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.columnDef.enableSorting !== false;
                  return (
                    <TableHead
                      key={header.id}
                      className={canSort ? "cursor-pointer select-none" : ""}
                      onClick={canSort ? () => handleSort(header.column.id) : undefined}
                    >
                      <span className="inline-flex items-center">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && <SortIcon columnId={header.column.id} />}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <SkeletonRows rows={pageSize > 10 ? 10 : pageSize} columns={columns.length} />
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => updateSearch({ pageSize: Number(value), page: 1 })}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {totalPages && (
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => updateSearch({ page: page - 1 })}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => updateSearch({ page: page + 1 })}
            disabled={totalPages ? page >= totalPages : data.length < pageSize}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
