import { Link, useMatches } from "@tanstack/react-router";

import { buttonVariants } from "@vps-ts-user-manager/ui/components/button";
import { Separator } from "@vps-ts-user-manager/ui/components/separator";
import { cn } from "@vps-ts-user-manager/ui/lib/utils";

const links = [
  { to: "/", label: "Status" },
  { to: "/users", label: "Users" },
  { to: "/backups", label: "Backups" },
  { to: "/services", label: "Services" },
] as const;

export default function Header() {
  const matches = useMatches();
  const activePath = matches[matches.length - 1]?.pathname ?? "/";

  return (
    <header>
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em]">
            user<span className="text-primary">/</span>manager
          </span>
          <nav className="flex items-center">
            {links.map(({ to, label }, i) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "font-mono text-xs uppercase tracking-wider",
                  i > 0 && "ml-0.5",
                  activePath === to
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <span className="label-mono hidden sm:block">authelia · tailnet only</span>
      </div>
      <Separator />
    </header>
  );
}
