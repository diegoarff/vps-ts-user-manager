import { queryOptions } from "@tanstack/react-query";

import {
  getBackupYamlFn,
  getSnapshot,
  getStatus,
  listBackupsFn,
  listServices,
} from "../functions/api";

export const snapshotQueryOptions = queryOptions({
  queryKey: ["snapshot"],
  queryFn: () => getSnapshot(),
});

export const statusQueryOptions = queryOptions({
  queryKey: ["status"],
  queryFn: () => getStatus(),
  refetchInterval: 30_000,
});

export const backupsQueryOptions = queryOptions({
  queryKey: ["backups"],
  queryFn: () => listBackupsFn(),
});

export const backupYamlQueryOptions = (name: string) =>
  queryOptions({
    queryKey: ["backup-yaml", name],
    queryFn: () => getBackupYamlFn({ data: { name } }),
    enabled: Boolean(name),
  });

export const servicesQueryOptions = queryOptions({
  queryKey: ["services"],
  queryFn: () => listServices(),
});
