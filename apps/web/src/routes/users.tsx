import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@vps-ts-user-manager/ui/components/badge";
import { Button } from "@vps-ts-user-manager/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@vps-ts-user-manager/ui/components/empty";
import { Skeleton } from "@vps-ts-user-manager/ui/components/skeleton";
import { Textarea } from "@vps-ts-user-manager/ui/components/textarea";

import { DataTable } from "../components/data-table";
import { EditUserPanel } from "../components/edit-user-panel";
import { PageHeader } from "../components/ui-bits";
import { DiffView } from "../components/diff-view";
import { applyChanges, exportYaml, importPreview, previewDiff } from "../functions/api";
import { snapshotQueryOptions } from "../lib/queries";
import type { UserDraft } from "../lib/types";

export const Route = createFileRoute("/users")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(snapshotQueryOptions);
  },
  component: UsersComponent,
});

async function downloadExport() {
  const yaml = await exportYaml();
  const blob = new Blob([yaml], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users_database.yml";
  a.click();
  URL.revokeObjectURL(url);
}

function UsersComponent() {
  const queryClient = useQueryClient();
  const snapshotQuery = useQuery(snapshotQueryOptions);

  const drafts = snapshotQuery.data?.drafts ?? [];
  const mtimeMs = snapshotQuery.data?.mtimeMs ?? 0;

  const [editing, setEditing] = useState<number | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [genLength, setGenLength] = useState(20);
  const [genSymbols, setGenSymbols] = useState(true);
  const [dirty, setDirty] = useState(false);

  const applyMutation = useMutation({
    mutationFn: (input: { drafts: UserDraft[] }) =>
      applyChanges({ data: { baseMtimeMs: mtimeMs, drafts: input.drafts } }),
    onSuccess: (_data, input) => {
      queryClient.setQueryData(["snapshot"], _data);
      void queryClient.invalidateQueries({ queryKey: ["status"] });
      const withPassword = input.drafts.find((d) => d.pendingPassword !== undefined);
      if (withPassword?.pendingPassword) {
        toast.success(
          `Saved. New password for ${withPassword.username} — copy it now, it will not be shown again.`,
          { description: withPassword.pendingPassword, duration: Infinity },
        );
      } else {
        toast.success("Users database saved.");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const diffMutation = useMutation({
    mutationFn: (input: { drafts: UserDraft[] }) => previewDiff({ data: input }),
    onError: (err: Error) => toast.error(err.message),
  });

  const importMutation = useMutation({
    mutationFn: (yamlText: string) => importPreview({ data: { yamlText } }),
    onSuccess: (imported) => {
      setImportOpen(false);
      setImportText("");
      // Replace local drafts; passwords must be re-set for entries that lost them.
      queryClient.setQueryData(["snapshot"], (old: typeof snapshotQuery.data) =>
        old ? { ...old, drafts: imported } : old,
      );
      setDirty(true);
      toast.info("YAML loaded into the editor. Review the diff, then save to apply.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function update(index: number, patch: Partial<UserDraft>) {
    setDirty(true);
    queryClient.setQueryData(["snapshot"], (old: typeof snapshotQuery.data) => {
      if (!old) return old;
      return {
        ...old,
        drafts: old.drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)),
      };
    });
  }

  async function addUser() {
    let username = "newuser";
    let n = 1;
    while (drafts.some((d) => d.username === username)) {
      username = `newuser${++n}`;
    }
    const fresh: UserDraft = {
      username,
      displayname: "",
      email: "",
      groups: ["users"],
      disabled: false,
      hasPassword: false,
    };
    setDirty(true);
    queryClient.setQueryData(["snapshot"], (old: typeof snapshotQuery.data) =>
      old ? { ...old, drafts: [...old.drafts, fresh] } : old,
    );
    setEditing(drafts.length);
  }

  async function removeUser(d: UserDraft) {
    if (!confirm(`Remove ${d.username} from the users database?`)) return;
    const next = drafts.filter((x) => x.username !== d.username);
    try {
      await applyChanges({ data: { baseMtimeMs: mtimeMs, drafts: next } });
      setDirty(false);
      if (editing === drafts.indexOf(d)) setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      toast.success(`Removed ${d.username}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function openReview() {
    try {
      const diff = await diffMutation.mutateAsync({ drafts });
      setReview(diff);
    } catch {
      /* handled by onError */
    }
  }

  async function confirmApply() {
    setReview(null);
    try {
      const result = await applyMutation.mutateAsync({ drafts });
      queryClient.setQueryData(["snapshot"], result);
      setDirty(false);
    } catch {
      /* handled by onError */
    }
  }

  const selected = editing !== null ? (drafts[editing] ?? null) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <PageHeader
        title="Users"
        description="Entries in the Authelia users database. Every save is diffed and backed up."
        actions={
          <>
            <Button size="sm" onClick={() => void addUser()}>
              Add user
            </Button>
            <Button variant="outline" size="sm" onClick={() => void downloadExport()}>
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(!importOpen)}
              aria-expanded={importOpen}
            >
              Import
            </Button>
          </>
        }
      />

      {selected && editing !== null && (
        <EditUserPanel
          index={editing}
          draft={selected}
          onApply={(patch) => update(editing, patch)}
          onClose={() => setEditing(null)}
          genLength={genLength}
          genSymbols={genSymbols}
          setGenLength={setGenLength}
          setGenSymbols={setGenSymbols}
        />
      )}

      {importOpen && (
        <div className="mb-6 border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="label-mono">Import YAML</p>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setImportOpen(false)}
              className="text-muted-foreground"
            >
              Close
            </Button>
          </div>
          <div className="grid gap-3 p-4">
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste users_database.yml content here…"
              rows={8}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Loading replaces the editor contents. Existing password hashes are kept for users you
              don't change.
            </p>
            <div>
              <Button
                size="sm"
                onClick={() => importMutation.mutate(importText)}
                disabled={!importText.trim()}
              >
                Load into editor
              </Button>
            </div>
          </div>
        </div>
      )}

      {snapshotQuery.isLoading && (
        <div className="grid gap-2">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      )}

      {!snapshotQuery.isLoading && drafts.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No users</EmptyTitle>
            <EmptyDescription>The users database exists but has no entries.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {drafts.length > 0 && (
        <DataTable
          columns={[
            {
              id: "user",
              header: "User",
              headerClassName: "w-2/5",
              cell: (d) => (
                <div>
                  <div className="font-medium">{d.displayname || d.username}</div>
                  <div className="font-mono text-xs text-muted-foreground">{d.username}</div>
                </div>
              ),
            },
            {
              id: "groups",
              header: "Groups",
              cell: (d) => (
                <div className="flex flex-wrap gap-1">
                  {d.groups.map((g) => (
                    <Badge key={g} variant="secondary" className="font-mono text-[10px]">
                      {g}
                    </Badge>
                  ))}
                </div>
              ),
            },
            {
              id: "status",
              header: "Status",
              cell: (d) => (
                <div className="flex flex-wrap gap-1">
                  {d.disabled ? (
                    <Badge variant="destructive" className="font-mono text-[10px]">
                      disabled
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-emerald-400/30 font-mono text-[10px] text-emerald-400"
                    >
                      active
                    </Badge>
                  )}
                  {d.pendingPassword !== undefined && (
                    <Badge
                      variant="outline"
                      className="border-amber-400/40 font-mono text-[10px] text-amber-400"
                    >
                      pw pending
                    </Badge>
                  )}
                </div>
              ),
            },
            {
              id: "actions",
              header: "Actions",
              align: "right",
              headerClassName: "w-36",
              cell: (d, i) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setEditing(editing === i ? null : i)}
                    className="font-mono"
                  >
                    {editing === i ? "close" : "edit"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="xs"
                    onClick={() => void removeUser(d)}
                    className="font-mono"
                  >
                    remove
                  </Button>
                </div>
              ),
            },
          ]}
          rows={drafts}
          getRowKey={(d) => d.username}
        />
      )}

      {drafts.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => void openReview()}
            disabled={!dirty || diffMutation.isPending}
          >
            {diffMutation.isPending ? "Computing diff…" : "Review changes"}
          </Button>
          {!dirty && <span className="text-xs text-muted-foreground">No changes yet</span>}
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDirty(false);
                void queryClient.refetchQueries({ queryKey: ["snapshot"] });
              }}
              className="text-muted-foreground"
            >
              Discard changes
            </Button>
          )}
        </div>
      )}

      {review !== null && (
        <div className="mt-4 border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="label-mono">Proposed changes</p>
            <span className="font-mono text-[10px] text-muted-foreground">
              passwords never appear in diffs
            </span>
          </div>
          <div className="grid gap-3 p-4">
            <DiffView diff={review} />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => void confirmApply()}
                disabled={applyMutation.isPending}
              >
                {applyMutation.isPending ? "Saving…" : "Confirm & save"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setReview(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
