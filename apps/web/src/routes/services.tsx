import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Alert, AlertDescription, AlertTitle } from "@vps-ts-user-manager/ui/components/alert";
import { Badge } from "@vps-ts-user-manager/ui/components/badge";
import { Button } from "@vps-ts-user-manager/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@vps-ts-user-manager/ui/components/empty";
import { Skeleton } from "@vps-ts-user-manager/ui/components/skeleton";

import { DataTable } from "../components/data-table";
import { PageShell } from "../components/page-shell";
import { servicesQueryOptions } from "../lib/queries";
import type { ServiceEntry, ServiceVisibility } from "../lib/types";

export const Route = createFileRoute("/services")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(servicesQueryOptions);
  },
  component: ServicesComponent,
});

function ServicesComponent() {
  const { data, isLoading, error, refetch, isFetching } = useQuery(servicesQueryOptions);

  return (
    <PageShell
      title="Services"
      description="Domains routed through Traefik. Read-only; editing access rules is planned for v2."
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      }
    >
      {isLoading && (
        <div className="grid gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not list services</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : String(error)}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && (data?.length ?? 0) === 0 && !error && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No routed domains found</EmptyTitle>
            <EmptyDescription>
              No Traefik routers were reported by the Docker socket.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {data && data.length > 0 && (
        <>
          <p className="label-mono mb-3">{visibilitySummary(data)}</p>
          <DataTable
            columns={[
              {
                id: "domain",
                header: "Domain",
                headerClassName: "w-1/2",
                cellClassName: "break-all font-mono text-xs",
                cell: (s) => s.domain,
              },
              {
                id: "visibility",
                header: "Visibility",
                align: "right",
                headerClassName: "w-28",
                cell: (s) => <VisibilityBadge visibility={s.visibility} />,
              },
            ]}
            rows={data}
            getRowKey={(s) => s.domain}
          />
        </>
      )}
    </PageShell>
  );
}

function visibilitySummary(services: ServiceEntry[]): string {
  const publicCount = services.filter((s) => s.visibility === "public").length;
  const tailnetCount = services.filter((s) => s.visibility === "tailnet").length;
  const autheliaCount = services.filter((s) => s.visibility === "authelia").length;
  return `${autheliaCount} authelia · ${tailnetCount} tailnet · ${publicCount} public of ${services.length}`;
}

const VISIBILITY_STYLES = {
  public: {
    label: "public",
    className: "border-sky-400/40 font-mono text-[10px] text-sky-400",
  },
  tailnet: {
    label: "tailnet",
    className: "border-amber-400/40 font-mono text-[10px] text-amber-400",
  },
  authelia: {
    label: "authelia",
    className: "border-emerald-400/30 font-mono text-[10px] text-emerald-400",
  },
} satisfies Record<ServiceVisibility, { label: string; className: string }>;

function VisibilityBadge({ visibility }: { visibility: ServiceVisibility }) {
  const style = VISIBILITY_STYLES[visibility];
  return (
    <Badge variant="outline" className={style.className}>
      {style.label}
    </Badge>
  );
}
