import { hash } from "@node-rs/argon2";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

import { env } from "@vps-ts-user-manager/env/server";

import type { BackupEntry, UserDraft, UsersSnapshot } from "../lib/types";

const MAX_BACKUPS = 20;

interface FileUser {
  disabled?: boolean;
  displayname?: string;
  password?: string;
  email?: string;
  groups?: string[];
}

export class UsersDbError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "UsersDbError";
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    algorithm: 2, // Argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export function generatePassword(length = 20, symbols = true): string {
  const alphabet = `abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789${symbols ? "!@#$%^&*-_=+" : ""}`;
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export async function readSnapshot(): Promise<UsersSnapshot> {
  const text = await readFile(usersDbPath(), "utf8");
  const drafts = parseDrafts(text);
  const mtimeMs = existsSync(usersDbPath()) ? statSync(usersDbPath()).mtimeMs : 0;
  return { mtimeMs, yaml: text, drafts };
}

export function validateDrafts(drafts: UserDraft[]): void {
  const seen = new Set<string>();
  for (const d of drafts) {
    const username = d.username.trim();
    if (!username || /\s/.test(username)) {
      throw new UsersDbError(`Invalid username: "${d.username}"`, 400);
    }
    const key = username.toLowerCase();
    if (seen.has(key)) {
      throw new UsersDbError(`Duplicate username: ${username}`, 400);
    }
    seen.add(key);
    if (!d.displayname?.trim()) {
      throw new UsersDbError(`${username}: display name is required`, 400);
    }
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) {
      throw new UsersDbError(`${username}: invalid email "${d.email}"`, 400);
    }
    if (!Array.isArray(d.groups) || d.groups.some((g) => !g.trim())) {
      throw new UsersDbError(`${username}: groups must be non-empty strings`, 400);
    }
    if (!d.hasPassword && d.pendingPassword === undefined) {
      throw new UsersDbError(`${username}: this user has no password set`, 400);
    }
    if (d.pendingPassword !== undefined && d.pendingPassword.length < 8) {
      throw new UsersDbError(`${username}: password must be at least 8 characters`, 400);
    }
  }
}

export function serializeDrafts(
  drafts: UserDraft[],
  existingYaml: string,
  resolvedPasswords: Record<string, string> = {},
): string {
  // SAFETY: every field below is read through optional chaining with fallbacks, so
  // any object shape that survives the constructor check degrades to defaults.
  const existing = YAML.parse(existingYaml) as { users?: Record<string, FileUser> } | null;
  const users: Record<string, FileUser> = {};
  const sorted = drafts.toSorted((a, b) => a.username.localeCompare(b.username));
  for (const d of sorted) {
    const prev = existing?.users?.[d.username];
    const password =
      d.pendingPassword !== undefined ? resolvedPasswords[d.username] : (prev?.password ?? "");
    if (!password) {
      throw new UsersDbError(`${d.username}: missing password hash`, 500);
    }
    users[d.username] = {
      disabled: d.disabled,
      displayname: d.displayname.trim(),
      password,
      email: d.email || undefined,
      groups: d.groups.toSorted((a, b) => a.localeCompare(b)),
    };
  }
  return `${YAML.stringify({ users }).trimEnd()}\n`;
}

async function resolveNewPasswords(drafts: UserDraft[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const d of drafts) {
    if (d.pendingPassword !== undefined) {
      out[d.username] = await hashPassword(d.pendingPassword);
    }
  }
  return out;
}

export async function applyDrafts(baseMtimeMs: number, drafts: UserDraft[]): Promise<string> {
  validateDrafts(drafts);
  const file = usersDbPath();
  const current = await readFile(file, "utf8").catch(() => "");
  const currentMtime = existsSync(file) ? statSync(file).mtimeMs : 0;
  if (currentMtime !== baseMtimeMs) {
    throw new UsersDbError(
      "The users database changed since you loaded it. Reload before saving.",
      409,
    );
  }

  const resolved = await resolveNewPasswords(drafts);
  const proposed = serializeDrafts(drafts, current, resolved);
  YAML.parse(proposed); // final parse check before touching disk

  await backupCurrent(current);

  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, proposed, "utf8");
  await rename(tmp, file);
  return proposed;
}

async function backupCurrent(content: string): Promise<void> {
  const dir = backupsDir();
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeFile(path.join(dir, `users_database.${stamp}.yml`), content, "utf8");
  await pruneBackups(dir);
}

async function pruneBackups(dir: string): Promise<void> {
  const names = (await readdir(dir))
    .filter((n) => n.startsWith("users_database.") && n.endsWith(".yml"))
    .toSorted()
    .toReversed();
  for (const name of names.slice(MAX_BACKUPS)) {
    await unlink(path.join(dir, name)).catch(() => undefined);
  }
}

export async function listBackups(): Promise<BackupEntry[]> {
  const dir = backupsDir();
  if (!existsSync(dir)) return [];
  const { readdir, stat } = await import("node:fs/promises");
  const names = (await readdir(dir)).filter(
    (n) => n.startsWith("users_database.") && n.endsWith(".yml"),
  );
  const entries = await Promise.all(
    names.map(async (name) => {
      const st = await stat(path.join(dir, name));
      return { name, sizeBytes: st.size, createdAtMs: st.mtimeMs };
    }),
  );
  return entries.toSorted((a, b) => b.createdAtMs - a.createdAtMs);
}

export async function restoreBackup(name: string): Promise<void> {
  if (!/^users_database\.[\w:-]+\.yml$/.test(name)) {
    throw new UsersDbError("Invalid backup name", 400);
  }
  const file = path.join(backupsDir(), name);
  const content = await readFile(file, "utf8").catch(() => {
    throw new UsersDbError("Backup not found", 404);
  });
  YAML.parse(content);
  const livePath = usersDbPath();
  await backupCurrent(await readFile(livePath, "utf8").catch(() => ""));
  const tmp = `${livePath}.tmp-${process.pid}`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, livePath);
}

export function parseDrafts(yamlText: string): UserDraft[] {
  // SAFETY: the constructor check rejects non-object documents; per-user fields are
  // read defensively in the mapping below.
  const doc = YAML.parse(yamlText) as { users?: Record<string, FileUser> } | null;
  if (!doc || doc.constructor !== Object || !doc.users) {
    throw new UsersDbError('Users database must have a top-level "users" map', 422);
  }
  return Object.entries(doc.users).map(([username, u]) => ({
    username,
    displayname: u.displayname ?? username,
    email: u.email ?? "",
    groups: Array.isArray(u.groups) ? u.groups : [],
    disabled: u.disabled === true,
    hasPassword: Boolean(u.password),
  }));
}

export async function exportYaml(): Promise<string> {
  return readFile(usersDbPath(), "utf8");
}

export async function getBackupYaml(name: string): Promise<string> {
  if (!/^users_database\.[\w:-]+\.yml$/.test(name)) {
    throw new UsersDbError("Invalid backup name", 400);
  }
  return readFile(path.join(backupsDir(), name), "utf8").catch(() => {
    throw new UsersDbError("Backup not found", 404);
  });
}

function usersDbPath(): string {
  return env.USERS_DB_PATH;
}

function backupsDir(): string {
  return env.BACKUPS_DIR;
}
