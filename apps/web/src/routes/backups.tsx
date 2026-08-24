import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { diffLines } from "diff";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@vps-ts-user-manager/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@vps-ts-user-manager/ui/components/empty";
import { Skeleton } from "@vps-ts-user-manager/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vps-ts-user-manager/ui/components/table";

import { DiffView } from "../components/diff-view";
import { PageHeader, StatCard } from "../components/ui-bits";
import { restoreBackupFn } from "../functions/api";
import { backupYamlQueryOptions, backupsQueryOptions, snapshotQueryOptions } from "../lib/queries";
import type { BackupEntry } from "../lib/types";

export const Route = createFileRoute("/backups")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(backupsQueryOptions);
  },
  component: BackupsComponent,
});

function BackupsComponent() {
  const queryClient = useQueryClient();
  const backupsQuery = useQuery(backupsQueryOptions);
  const [selected, setSelected] = useState<BackupEntry | null>(null);

  const backupYamlQuery = useQuery(backupYamlQueryOptions(selected?.name ?? ""));

  const liveYamlQuery = useQuery(snapshotQueryOptions);

  function restoreDiff(): string | null {
    if (!backupYamlQuery.data || !liveYamlQuery.data) return null;
    // "+" lines are what restoring would bring in; "-" lines are what would be replaced.
    const parts = diffLines(liveYamlQuery.data.yaml, backupYamlQuery.data);
    let out = "";
    for (const part of parts) {
      for (const line of part.value.split("\n").slice(0, part.count ?? undefined)) {
        if (part.added) out += `+ ${line}\n`;
        else if (part.removed) out += `- ${line}\n`;
        else out += `  ${line}\n`;
      }
    }
    return out;
  }

  const restoreMutation = useMutation({
    mutationFn: (name: string) => restoreBackupFn({ data: { name } }),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["snapshot"], snapshot);
      void queryClient.invalidateQueries({ queryKey: ["backups"] });
      void queryClient.invalidateQueries({ queryKey: ["status"] });
      void queryClient.invalidateQueries({ queryKey: ["backup-yaml"] });
      setSelected(null);
      toast.success("Backup restored.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const backups = backupsQuery.data ?? [];
  const diff = selected ? restoreDiff() : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <PageHeader
        title="Backups"
        description="A backup is taken before every save. The latest 20 are kept."
      />

      {backupsQuery.isLoading && (
        <div className="grid gap-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      )}

      {!backupsQuery.isLoading && backups.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No backups yet</EmptyTitle>
            <EmptyDescription>They appear after your first save.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {backups.length > 0 && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <StatCard label="Kept" value={String(backups.length)} sub="of max 20" />
            <StatCard
              label="Latest"
              value={new Date(backups[0].createdAtMs).toLocaleDateString()}
              sub={new Date(backups[0].createdAtMs).toLocaleTimeString()}
            />
            <StatCard
              label="Total size"
              value={`${(backups.reduce((sum, b) => sum + b.sizeBytes, 0) / 1024).toFixed(1)} KB`}
              sub="on disk"
            />
          </div>

          <div className="border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="label-mono">File</TableHead>
                  <TableHead className="label-mono">Created</TableHead>
                  <TableHead className="w-36 text-right label-mono">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((b) => (
                  <TableRow key={b.name}>
                    <TableCell className="font-mono text-xs">{b.name}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {new Date(b.createdAtMs).toLocaleString()}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground/70">
                        {(b.sizeBytes / 1024).toFixed(1)} KB
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          className="font-mono"
                          onClick={() => setSelected(selected?.name === b.name ? null : b)}
                        >
                          {selected?.name === b.name ? "hide" : "inspect"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="xs"
                          className="font-mono"
                          disabled={restoreMutation.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Restore ${b.name}? This replaces the current users database; the current file is backed up first.`,
                              )
                            ) {
                              restoreMutation.mutate(b.name);
                            }
                          }}
                        >
                          restore
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {selected && (
        <div className="mt-4 border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="label-mono">Restore preview · {selected.name}</p>
            <span className="font-mono text-[10px] text-muted-foreground">
              "+" comes back · "-" is replaced
            </span>
          </div>
          <div className="p-4">
            {backupYamlQuery.isLoading || !diff ? (
              <Skeleton className="h-24" />
            ) : (
              <DiffView diff={diff} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
