import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";

import { Button } from "@vps-ts-user-manager/ui/components/button";
import { Checkbox } from "@vps-ts-user-manager/ui/components/checkbox";
import { Input } from "@vps-ts-user-manager/ui/components/input";
import { Label } from "@vps-ts-user-manager/ui/components/label";
import { Switch } from "@vps-ts-user-manager/ui/components/switch";

import type { UserDraft } from "../lib/types";

const editUserSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, "Use letters, digits, dots or dashes"),
  displayname: z.string().min(1, "Display name is required"),
  email: z.string().refine((v) => v === "" || /^\S+@\S+\.\S+$/.test(v), "Invalid email address"),
  groupsText: z.string(),
  disabled: z.boolean(),
  pendingPassword: z
    .string()
    .refine((v) => v === "" || v.length >= 8, "Password must be at least 8 characters"),
});

interface EditFormValues {
  username: string;
  displayname: string;
  email: string;
  groupsText: string;
  disabled: boolean;
  pendingPassword: string;
}

function toPatch(v: EditFormValues): Partial<UserDraft> {
  return {
    username: v.username.trim(),
    displayname: v.displayname.trim(),
    email: v.email.trim(),
    groups: v.groupsText
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean),
    disabled: v.disabled,
    pendingPassword: v.pendingPassword === "" ? undefined : v.pendingPassword,
  };
}

function FieldError({ field }: { field: AnyFieldApi }) {
  const message = field.state.meta.errors.map((e) => e?.message).find(Boolean);
  if (!message) return null;
  return <p className="text-xs text-red-400">{message}</p>;
}

export function EditUserPanel({
  index,
  draft,
  onApply,
  onClose,
  genLength,
  genSymbols,
  setGenLength,
  setGenSymbols,
}: {
  index: number;
  draft: UserDraft;
  onApply: (patch: Partial<UserDraft>) => void;
  onClose: () => void;
  genLength: number;
  genSymbols: boolean;
  setGenLength: (n: number) => void;
  setGenSymbols: (v: boolean) => void;
}) {
  const form = useForm({
    defaultValues: {
      username: draft.username,
      displayname: draft.displayname,
      email: draft.email,
      groupsText: draft.groups.join(", "),
      disabled: draft.disabled,
      pendingPassword: draft.pendingPassword ?? "",
    },
    validators: { onChange: editUserSchema },
    listeners: {
      // Sync every change into the working copy so the diff preview and
      // dirty state stay live; the server re-validates on apply.
      onChange: ({ formApi }) => {
        // SAFETY: the form's values type is EditFormValues by construction —
        // defaultValues and every field name come from that exact interface.
        onApply(toPatch(formApi.state.values as EditFormValues));
      },
    },
  });

  async function generatePassword() {
    const pw = await import("../functions/api").then((m) =>
      m.generatePasswordFn({ data: { length: genLength, symbols: genSymbols } }),
    );
    form.setFieldValue("pendingPassword", pw);
    navigator.clipboard.writeText(pw).catch(() => undefined);
  }

  return (
    <div className="mb-6 border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="label-mono">
          Edit · entry {index + 1} · {draft.hasPassword ? "existing user" : "new user"}
        </p>
        <Button variant="ghost" size="xs" onClick={onClose} className="text-muted-foreground">
          Close
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <div className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2">
          <form.Field
            name="username"
            children={(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={field.name} className="label-mono">
                  Username
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={draft.hasPassword}
                  className="font-mono"
                />
                <FieldError field={field} />
                <FieldHint>
                  {draft.hasPassword
                    ? "Locked — usernames of existing users cannot be renamed"
                    : "Lowercase letters, digits, dots and dashes"}
                </FieldHint>
              </div>
            )}
          />
          <form.Field
            name="displayname"
            children={(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={field.name} className="label-mono">
                  Display name
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <FieldError field={field} />
                <FieldHint>Shown on the Authelia sign-in page</FieldHint>
              </div>
            )}
          />
          <form.Field
            name="email"
            children={(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={field.name} className="label-mono">
                  Email
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="font-mono text-xs"
                />
                <FieldError field={field} />
                <FieldHint>Identifies the user to Authelia</FieldHint>
              </div>
            )}
          />
          <form.Field
            name="groupsText"
            children={(field) => (
              <div className="grid gap-1.5">
                <Label htmlFor={field.name} className="label-mono">
                  Groups
                </Label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="font-mono text-xs"
                />
                <FieldError field={field} />
                <FieldHint>Comma-separated, e.g. users, admins</FieldHint>
              </div>
            )}
          />

          <div className="sm:col-span-2 border-t pt-4">
            <form.Field
              name="disabled"
              children={(field) => (
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <Label htmlFor={field.name} className="label-mono">
                      Disabled
                    </Label>
                    <p className="mt-1 max-w-prose text-xs text-muted-foreground">
                      Blocks sign-in without deleting the entry. Existing sessions are not revoked.
                    </p>
                  </div>
                  <Switch
                    id={field.name}
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked === true)}
                    aria-label="Disabled"
                  />
                </div>
              )}
            />
          </div>

          <div className="sm:col-span-2 border-t pt-4">
            <p className="label-mono">Password</p>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              {draft.hasPassword
                ? "Leave empty to keep the current password."
                : "Required for a new user — generate one or type it."}
            </p>
            <form.Field
              name="pendingPassword"
              children={(field) => (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder={draft.hasPassword ? "unchanged" : "required for new users"}
                      className="flex-1 font-mono text-xs"
                    />
                    <Button type="button" variant="outline" onClick={() => void generatePassword()}>
                      Generate
                    </Button>
                  </div>
                  <FieldError field={field} />
                </>
              )}
            />
            <div className="mt-3 flex items-center gap-5">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Length
                <Input
                  type="number"
                  min={8}
                  max={64}
                  value={genLength}
                  onChange={(e) => setGenLength(Number(e.target.value))}
                  className="h-8 w-20 font-mono text-xs"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={genSymbols === true}
                  onCheckedChange={(checked) => setGenSymbols(checked === true)}
                />
                Include symbols
              </label>
              <span className="ml-auto hidden text-xs text-muted-foreground/70 sm:block">
                generated passwords are copied to your clipboard and shown once after saving
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
