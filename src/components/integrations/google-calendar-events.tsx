"use client";

import { CalendarX, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type CalendarEvent = {
  id: string;
  summary?: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string };
  organizer?: { displayName?: string; email?: string };
};

export function GoogleCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/integrations/google/calendar");
        const payload = (await response.json()) as {
          events?: CalendarEvent[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(payload.error || "Calendar could not be loaded.");
        setEvents(payload.events ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Calendar is unavailable.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return (
      <p className="px-6 py-12 text-sm text-muted-foreground">
        Loading upcoming events...
      </p>
    );
  if (error)
    return <p className="px-6 py-12 text-sm text-destructive">{error}</p>;
  if (events.length === 0)
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <CalendarX
          className="size-9 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="mt-3 font-medium">No upcoming events</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your primary Google Calendar is clear.
        </p>
      </div>
    );

  return (
    <div className="divide-y border-t">
      {events.map((event) => {
        const start = event.start.dateTime ?? event.start.date ?? "";
        return (
          <div
            key={event.id}
            className="grid gap-2 px-4 py-4 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:px-6"
          >
            <time className="text-sm text-muted-foreground">
              {start
                ? new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: event.start.dateTime ? "numeric" : undefined,
                    minute: event.start.dateTime ? "2-digit" : undefined,
                  }).format(new Date(start))
                : "Unscheduled"}
            </time>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {event.summary || "Untitled event"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {event.organizer?.displayName ??
                  event.organizer?.email ??
                  "Google Calendar"}
              </p>
            </div>
            {event.htmlLink && (
              <Button
                size="icon"
                variant="ghost"
                asChild
                title="Open in Google Calendar"
              >
                <a href={event.htmlLink} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
