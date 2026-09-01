import type { ReactNode } from "react";

import { cn } from "@vps-ts-user-manager/ui/lib/utils";

import { PageHeader } from "./ui-bits";

/**
 * Shared page frame.
 *
 * Every page renders through this so the layout is consistent and, more
 * importantly, contained: `min-w-0` + `overflow-x-hidden` on the frame ensure
 * a child (a wide table or an unbreakable diff line) scrolls inside its own
 * panel instead of widening the page. `max-w-4xl` keeps content readable.
 */
export function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="min-w-0 flex-1 overflow-x-hidden">
      <div className={cn("mx-auto w-full max-w-4xl min-w-0 px-4 py-6 sm:px-6", className)}>
        <PageHeader title={title} description={description} actions={actions} />
        {children}
      </div>
    </div>
  );
}
