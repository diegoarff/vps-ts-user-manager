export interface UserDraft {
  username: string;
  displayname: string;
  email: string;
  groups: string[];
  disabled: boolean;
  /** Plaintext password to hash on apply. Never stored, never echoed after save. */
  pendingPassword?: string;
  /** True when the entry already has a password hash in the users database. */
  hasPassword: boolean;
}

export interface UsersSnapshot {
  mtimeMs: number;
  yaml: string;
  drafts: UserDraft[];
}

export interface BackupEntry {
  name: string;
  sizeBytes: number;
  createdAtMs: number;
}

export interface ApplyResult {
  snapshot: UsersSnapshot;
  appliedUsername: string | null;
  generatedPassword: string | null;
}

export type ServiceVisibility = "public" | "tailnet" | "authelia";

export interface ServiceEntry {
  domain: string;
  containers: string[];
  autheliaProtected: boolean;
  visibility: ServiceVisibility;
}

export interface StatusInfo {
  userCount: number;
  fileMtimeMs: number | null;
  lastBackupAtMs: number | null;
  backupCount: number;
  autheliaReachable: boolean;
  autheliaUrl: string;
}
