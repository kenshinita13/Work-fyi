import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-6 py-16 sm:px-10">
        <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Secure web foundation
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div className="space-y-6">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-balance sm:text-6xl">
              Work.fyi is starting with workspace-grade trust.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              The first milestone is a production-oriented Next.js foundation
              for authentication, tenant isolation, task operations, audit
              history, and reviewed AI output.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button>
                Continue setup
                <ArrowRight
                  data-icon="inline-end"
                  className="size-4"
                  aria-hidden="true"
                />
              </Button>
              <Button variant="outline">Review security baseline</Button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 text-sm shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-medium">Phase 0</span>
              <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                In progress
              </span>
            </div>
            <dl className="grid gap-3 text-muted-foreground">
              <div className="flex items-center justify-between gap-4">
                <dt>App Router</dt>
                <dd className="font-mono text-foreground">Ready</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Typed env</dt>
                <dd className="font-mono text-foreground">Added</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>RLS migration</dt>
                <dd className="font-mono text-foreground">Drafted</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
