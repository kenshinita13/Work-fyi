"use client";

import { FilePenLine, Inbox, Search, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type GmailMessage = {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

type EmailSummary = {
  summary: string;
  actionItems: string[];
  importantDates: string[];
};

async function responseMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error || fallback;
}

export function GoogleMailWorkspace() {
  const [mode, setMode] = useState<"inbox" | "draft">("inbox");
  const [query, setQuery] = useState("in:inbox");
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [summary, setSummary] = useState<EmailSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [draft, setDraft] = useState({ to: "", subject: "", body: "" });

  async function loadMessages(search = query) {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/integrations/google/gmail?q=${encodeURIComponent(search)}`,
      );
      const payload = (await response.json()) as {
        messages?: GmailMessage[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error || "Gmail messages could not be loaded.");
      setMessages(payload.messages ?? []);
      setSelected([]);
      setSummary(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gmail is unavailable.",
      );
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/integrations/google/gmail?q=in%3Ainbox")
      .then(async (response) => {
        const payload = (await response.json()) as {
          messages?: GmailMessage[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(
            payload.error || "Gmail messages could not be loaded.",
          );
        if (active) setMessages(payload.messages ?? []);
      })
      .catch((error: unknown) => {
        if (active)
          toast.error(
            error instanceof Error ? error.message : "Gmail is unavailable.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    void loadMessages(query);
  }

  function toggleMessage(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 10
          ? [...current, id]
          : current,
    );
  }

  async function summarize() {
    setSummarizing(true);
    try {
      const response = await fetch("/api/integrations/google/gmail/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: selected }),
      });
      if (!response.ok)
        throw new Error(await responseMessage(response, "Summary failed."));
      setSummary((await response.json()) as EmailSummary);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Summary failed.");
    } finally {
      setSummarizing(false);
    }
  }

  async function createDraft(event: FormEvent) {
    event.preventDefault();
    setDrafting(true);
    try {
      const response = await fetch("/api/integrations/google/gmail/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, confirmed: reviewed }),
      });
      if (!response.ok)
        throw new Error(
          await responseMessage(response, "Gmail draft could not be created."),
        );
      toast.success("Draft created in Gmail.");
      setDraft({ to: "", subject: "", body: "" });
      setReviewed(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Draft failed.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <div className="flex h-9 items-center rounded-md border p-0.5">
          <Button
            size="sm"
            variant={mode === "inbox" ? "secondary" : "ghost"}
            onClick={() => setMode("inbox")}
          >
            <Inbox className="size-4" aria-hidden="true" /> Inbox
          </Button>
          <Button
            size="sm"
            variant={mode === "draft" ? "secondary" : "ghost"}
            onClick={() => setMode("draft")}
          >
            <FilePenLine className="size-4" aria-hidden="true" /> Draft
          </Button>
        </div>
        {mode === "inbox" && (
          <form
            className="ml-auto flex w-full max-w-lg gap-2 sm:w-auto"
            onSubmit={search}
          >
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Gmail"
              aria-label="Search Gmail"
            />
            <Button
              type="submit"
              size="icon"
              variant="outline"
              disabled={loading}
            >
              <Search className="size-4" aria-hidden="true" />
            </Button>
          </form>
        )}
      </div>

      {mode === "inbox" ? (
        <div className="grid border-t lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <div className="divide-y lg:border-r">
            {loading ? (
              <p className="px-6 py-12 text-sm text-muted-foreground">
                Loading Gmail...
              </p>
            ) : messages.length === 0 ? (
              <p className="px-6 py-12 text-sm text-muted-foreground">
                No messages matched this search.
              </p>
            ) : (
              messages.map((message) => (
                <label
                  key={message.id}
                  className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3 hover:bg-muted/40 sm:px-6"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(message.id)}
                    onChange={() => toggleMessage(message.id)}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="flex gap-3 text-sm">
                      <strong className="truncate font-medium">
                        {message.from}
                      </strong>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {message.date
                          ? new Date(message.date).toLocaleDateString()
                          : ""}
                      </span>
                    </span>
                    <span className="block truncate text-sm">
                      {message.subject}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {message.snippet}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
          <aside className="p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              <h2 className="font-semibold">Selected email summary</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Select up to 10 messages. Only those messages are sent to the
              configured AI provider.
            </p>
            <Button
              className="mt-4"
              onClick={summarize}
              disabled={selected.length === 0 || summarizing}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {summarizing
                ? "Summarizing..."
                : `Summarize ${selected.length || "selected"}`}
            </Button>
            {summary && (
              <div className="mt-6 space-y-5 text-sm">
                <div>
                  <h3 className="font-medium">Summary</h3>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {summary.summary}
                  </p>
                </div>
                {summary.actionItems.length > 0 && (
                  <div>
                    <h3 className="font-medium">Action items</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                      {summary.actionItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {summary.importantDates.length > 0 && (
                  <div>
                    <h3 className="font-medium">Important dates</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                      {summary.importantDates.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      ) : (
        <form
          className="max-w-3xl space-y-5 border-t px-4 py-6 sm:px-6"
          onSubmit={createDraft}
        >
          <div className="space-y-2">
            <Label htmlFor="gmail-to">To</Label>
            <Input
              id="gmail-to"
              type="email"
              value={draft.to}
              onChange={(event) => {
                setDraft((current) => ({ ...current, to: event.target.value }));
                setReviewed(false);
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gmail-subject">Subject</Label>
            <Input
              id="gmail-subject"
              value={draft.subject}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  subject: event.target.value,
                }));
                setReviewed(false);
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gmail-body">Message</Label>
            <Textarea
              id="gmail-body"
              className="min-h-72"
              value={draft.body}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  body: event.target.value,
                }));
                setReviewed(false);
              }}
              required
            />
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              I reviewed the recipient, subject, and message. Create this as a
              Gmail draft without sending it.
            </span>
          </label>
          <Button type="submit" disabled={!reviewed || drafting}>
            <FilePenLine className="size-4" aria-hidden="true" />
            {drafting ? "Creating draft..." : "Create Gmail draft"}
          </Button>
        </form>
      )}
    </div>
  );
}
