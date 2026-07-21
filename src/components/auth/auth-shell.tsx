import { Layers3 } from "lucide-react";

import { ThemeSwitcher } from "@/components/theme-switcher";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)]">
      <div className="fixed top-4 right-4 z-20">
        <ThemeSwitcher />
      </div>
      <section className="hidden border-r border-border bg-muted/20 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Layers3 className="size-5" aria-hidden="true" />
          </span>
          Work.fyi
        </div>
        <div className="max-w-xl space-y-5">
          <p className="text-sm font-medium text-primary">Work operations</p>
          <h1 className="text-4xl leading-tight font-semibold tracking-normal text-balance xl:text-5xl">
            Keep projects, tasks, and AI-assisted work in one accountable place.
          </h1>
          <p className="max-w-lg text-base leading-7 text-muted-foreground">
            A secure workspace for planning the work, tracking decisions, and
            keeping every action tied to the right team.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Secure by default. Workspace access is enforced in the database.
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 text-sm font-semibold lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Layers3 className="size-5" aria-hidden="true" />
            </span>
            Work.fyi
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
