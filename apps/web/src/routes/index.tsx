import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Button } from "@vps-ts-user-manager/ui/components/button";
import { Skeleton } from "@vps-ts-user-manager/ui/components/skeleton";

import { PageHeader, StatCard, StatusDot } from "../components/ui-bits";
import { statusQueryOptions } from "../lib/queries";

export const Route = createFileRoute("/")({
  // Kick off the fetch early without blocking SSR; the integration streams it.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(statusQueryOptions);
  },
  component: StatusComponent,
});

function StatusComponent() {
  const { data, isLoading, error, refetch, isFetching } = useQuery(statusQueryOptions);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <Skeleton className="mb-6 h-14" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <p className="font-mono text-sm text-red-400">
          status: unavailable — is the users database mounted?
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <PageHeader
        title="Status"
        description="Live state of the users database and the Authelia instance it feeds."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={String(data.userCount)} sub="entries in the database" />
        <StatCard
          label="Authelia"
          value={data.autheliaReachable ? "Online" : "Offline"}
          tone={data.autheliaReachable ? "ok" : "bad"}
          sub={<StatusDot ok={data.autheliaReachable}>{data.autheliaUrl}</StatusDot>}
        />
        <StatCard
          label="Last modified"
          value={
            data.fileMtimeMs
              ? new Date(data.fileMtimeMs).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
          sub={data.fileMtimeMs ? new Date(data.fileMtimeMs).toLocaleDateString() : "unknown"}
        />
        <StatCard
          label="Backups"
          value={String(data.backupCount)}
          sub={
            data.lastBackupAtMs
              ? `latest ${new Date(data.lastBackupAtMs).toLocaleString()}`
              : "none yet"
          }
        />
      </div>

      <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
        User changes apply within seconds via Authelia's file watcher. Restarts are only needed for
        configuration.yml changes, which this app does not edit.
      </p>
    </div>
  );
}
