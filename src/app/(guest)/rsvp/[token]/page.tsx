"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Check } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { EVENTS, EventKey } from "@/lib/events";
import { cn } from "@/lib/utils";

export default function RsvpPage() {
  return (
    <Suspense>
      <RsvpInner />
    </Suspense>
  );
}

function RsvpInner() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const sendId = searchParams.get("s") as Id<"sends"> | null;

  const guest = useQuery(api.guest.getByToken, { token });
  const chooseWedding = useMutation(api.guest.chooseWedding);
  const markOpened = useMutation(api.guest.markOpened);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (sendId) void markOpened({ token, sendId });
  }, [token, sendId, markOpened]);

  const choose = async (choice: EventKey) => {
    setError(null);
    try {
      await chooseWedding({ token, choice, sendId: sendId ?? undefined });
      setChanging(false);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("capacity:")
          ? "We're so sorry — that celebration is already full. Please choose the other one."
          : "Something went wrong. Please try again."
      );
    }
  };

  if (guest === undefined) {
    return (
      <GuestShell>
        <p className="text-sm font-light text-muted-foreground">Loading…</p>
      </GuestShell>
    );
  }
  if (guest === null) {
    return (
      <GuestShell>
        <p className="text-sm font-light text-muted-foreground">
          This link isn&apos;t valid. Please check the message you received.
        </p>
      </GuestShell>
    );
  }

  if (guest.attendance && !changing) {
    const label =
      guest.attendance === "both"
        ? "both celebrations"
        : EVENTS[guest.attendance as EventKey].label;
    return (
      <GuestShell>
        <Check className="mx-auto mb-3 size-8 text-[var(--both)]" />
        <h1 className="mb-2 text-2xl font-semibold">
          Thank you, {guest.name}!
        </h1>
        <p className="text-sm font-light text-muted-foreground">
          You&apos;re confirmed for <strong>{label}</strong>. We can&apos;t
          wait to celebrate with you 🎉
        </p>
        {guest.attendance !== "both" && (
          <button
            onClick={() => setChanging(true)}
            className="mt-4 text-xs font-light text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Need to change your choice?
          </button>
        )}
      </GuestShell>
    );
  }

  return (
    <GuestShell>
      <h1 className="mb-1 text-2xl font-semibold">Hi {guest.name} 👋</h1>
      <p className="mb-6 text-sm font-light text-muted-foreground">
        We&apos;re celebrating twice! Which wedding would you like to attend?
      </p>
      <div className="grid gap-3">
        {guest.events.map((event) => {
          const meta = EVENTS[event.key as EventKey];
          return (
            <Button
              key={event.key}
              size="lg"
              variant="outline"
              disabled={event.full}
              onClick={() => choose(event.key as EventKey)}
              className={cn(
                "h-auto flex-col items-start gap-0.5 py-3",
                meta.tone,
                "border-transparent hover:opacity-90"
              )}
            >
              <span className="text-base font-medium">{event.name}</span>
              <span className="text-xs font-light opacity-80">
                {event.full
                  ? "Fully booked"
                  : [event.date, event.venue].filter(Boolean).join(" · ") ||
                    "Tap to choose"}
              </span>
            </Button>
          );
        })}
      </div>
      {error && (
        <p className="mt-4 text-sm font-light text-destructive">{error}</p>
      )}
    </GuestShell>
  );
}

function GuestShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbfbfa] p-6">
      <div className="w-full max-w-sm rounded-md border bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}
