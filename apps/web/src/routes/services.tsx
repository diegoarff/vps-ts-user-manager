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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vps-ts-user-manager/ui/components/table";

import { PageHeader } from "../components/ui-bits";
import { servicesQueryOptions } from "../lib/queries";

export const Route = createFileRoute("/services")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(servicesQueryOptions);
  },
  component: ServicesComponent,
});

function ServicesComponent() {
  const { data, isLoading, error, refetch, isFetching } = useQuery(servicesQueryOptions);

  const protectedCount = data?.filter((s) => s.autheliaProtected).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <PageHeader
        title="Services"
        description="Domains routed through Traefik. Read-only; editing access rules is planned for v2."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

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
          <p className="label-mono mb-3">
            {protectedCount} of {data.length} behind authelia
          </p>
          <div className="border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="label-mono">Domain</TableHead>
                  <TableHead className="label-mono">Container</TableHead>
                  <TableHead className="w-28 text-right label-mono">Auth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.domain}>
                    <TableCell className="font-mono text-xs">{s.domain}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.containers.join(", ")}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.autheliaProtected ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-400/30 font-mono text-[10px] text-emerald-400"
                        >
                          authelia
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="font-mono text-[10px] text-muted-foreground"
                        >
                          none
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
