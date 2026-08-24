import { createServerFn } from "@tanstack/react-start";
import { diffLines } from "diff";
import { z } from "zod";

import { env } from "@vps-ts-user-manager/env/server";

import type { BackupEntry, ServiceEntry, StatusInfo, UserDraft, UsersSnapshot } from "../lib/types";
import {
  applyDrafts,
  exportYaml as exportYamlFile,
  generatePassword as genPassword,
  listBackups,
  parseDrafts,
  readSnapshot,
  restoreBackup,
  serializeDrafts,
  validateDrafts,
} from "../server/users-db";

export const getSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<UsersSnapshot> => readSnapshot(),
);

const draftsValidator = z.array(
  z.object({
    username: z.string(),
    displayname: z.string(),
    email: z.string(),
    groups: z.array(z.string()),
    disabled: z.boolean(),
    pendingPassword: z.string().optional(),
    hasPassword: z.boolean(),
  }),
);

export const applyChanges = createServerFn({ method: "POST" })
  .validator(
    z.object({
      baseMtimeMs: z.number(),
      drafts: draftsValidator,
    }),
  )
  .handler(async ({ data }): Promise<UsersSnapshot> => {
    await applyDrafts(data.baseMtimeMs, data.drafts);
    return readSnapshot();
  });

export const previewDiff = createServerFn({ method: "POST" })
  .validator(z.object({ drafts: draftsValidator }))
  .handler(async ({ data }): Promise<string> => {
    const current = await readSnapshot();
    validateDrafts(data.drafts);
    const proposed = serializeDrafts(data.drafts, current.yaml);
    return renderDiff(current.yaml, proposed);
  });

function renderDiff(currentYaml: string, proposedYaml: string): string {
  const parts = diffLines(currentYaml, proposedYaml);
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

export const listBackupsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<BackupEntry[]> => listBackups(),
);

export const restoreBackupFn = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string() }))
  .handler(async ({ data }): Promise<UsersSnapshot> => {
    await restoreBackup(data.name);
    return readSnapshot();
  });

export const exportYaml = createServerFn({ method: "GET" }).handler(async (): Promise<string> =>
  exportYamlFile(),
);

export const getBackupYamlFn = createServerFn({ method: "GET" })
  .validator(z.object({ name: z.string() }))
  .handler(async ({ data }): Promise<string> => {
    const { getBackupYaml } = await import("../server/users-db");
    return getBackupYaml(data.name);
  });

export const importPreview = createServerFn({ method: "POST" })
  .validator(z.object({ yamlText: z.string() }))
  .handler(async ({ data }): Promise<UserDraft[]> => {
    const drafts = parseDrafts(data.yamlText);
    validateDrafts(drafts.map((d) => ({ ...d, hasPassword: true, pendingPassword: undefined })));
    return drafts;
  });

export const getStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<StatusInfo> => {
    const snapshot = await readSnapshot().catch(() => null);
    const backups = await listBackups().catch(() => []);
    const reachable = await fetch(`${env.AUTHELIA_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    })
      .then((r) => r.ok)
      .catch(() => false);
    return {
      userCount: snapshot?.drafts.length ?? 0,
      fileMtimeMs: snapshot?.mtimeMs ?? null,
      lastBackupAtMs: backups[0]?.createdAtMs ?? null,
      backupCount: backups.length,
      autheliaReachable: reachable,
      autheliaUrl: env.AUTHELIA_URL,
    };
  },
);

export const listServices = createServerFn({ method: "GET" }).handler(
  async (): Promise<ServiceEntry[]> => {
    const { listProtectedServices } = await import("../server/docker");
    return listProtectedServices();
  },
);

export const generatePasswordFn = createServerFn({ method: "GET" })
  .validator(
    z.object({
      length: z.number().min(8).max(64).default(20),
      symbols: z.boolean().default(true),
    }),
  )
  .handler(({ data }) => genPassword(data.length, data.symbols));
