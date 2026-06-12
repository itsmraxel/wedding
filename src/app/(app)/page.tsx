"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EVENTS, EventKey } from "@/lib/events";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border bg-card p-4 transition-colors hover:bg-muted/40"
    >
      <p className="text-xs font-light text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && (
        <p className="mt-0.5 text-xs font-light text-muted-foreground">
          {hint}
        </p>
      )}
    </Link>
  );
}

// Edit date, venue, and capacity for one event in a single popover.
function EventEditor({
  eventKey,
  date,
  venue,
  capacity,
}: {
  eventKey: EventKey;
  date: string | null;
  venue: string | null;
  capacity: number | null;
}) {
  const updateEvent = useMutation(api.events.updateEvent);
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState(date ?? "");
  const [venueValue, setVenueValue] = useState(venue ?? "");
  const [capValue, setCapValue] = useState(capacity?.toString() ?? "");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          title={`Edit ${EVENTS[eventKey].label}`}
        >
          <Pencil className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <p className="mb-3 text-xs font-light text-muted-foreground">
          Shown to guests on their RSVP page.
        </p>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs font-light">Date</Label>
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="h-8 font-light"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs font-light">Venue</Label>
            <Input
              value={venueValue}
              onChange={(e) => setVenueValue(e.target.value)}
              placeholder="e.g. Kigali Convention Centre"
              className="h-8 font-light"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs font-light">
              Guest capacity (empty = no limit)
            </Label>
            <Input
              type="number"
              min={1}
              value={capValue}
              onChange={(e) => setCapValue(e.target.value)}
              placeholder="No limit"
              className="h-8 font-light"
            />
          </div>
          <Button
            size="sm"
            onClick={async () => {
              const cap = capValue === "" ? undefined : parseInt(capValue, 10);
              if (cap !== undefined && (!Number.isFinite(cap) || cap < 1)) {
                toast.error("Capacity must be at least 1.");
                return;
              }
              await updateEvent({
                key: eventKey,
                date: dateValue || undefined,
                venue: venueValue.trim() || undefined,
                capacity: cap,
              });
              toast.success(`${EVENTS[eventKey].label} updated.`);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function DashboardPage() {
  const stats = useQuery(api.dashboard.dashboardStats);
  const recent = useQuery(api.sends.recentSends, { limit: 6 });
  const campaigns = useQuery(api.scheduled.listScheduled);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A live overview of both celebrations — click any number to act on it."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total guests"
          value={stats?.totalGuests ?? "—"}
          href="/guests"
        />
        <StatCard
          label="Undecided"
          value={
            <span
              className={cn(
                (stats?.attendance.undecided ?? 0) > 0 &&
                  "text-[var(--traditional)]"
              )}
            >
              {stats?.attendance.undecided ?? "—"}
            </span>
          }
          hint="Haven't chosen a wedding yet"
          href="/guests?attendance=undecided"
        />
        <StatCard
          label="RSVP replies"
          value={
            <span className="text-[var(--both)]">
              {stats?.rsvp.replied ?? "—"}
            </span>
          }
          hint={
            stats
              ? `${stats.rsvp.detailsSubmitted} shared allergies or needs`
              : undefined
          }
          href="/messages"
        />
      </div>

      <section className="mt-6 rounded-md border bg-card p-5">
        <h2 className="mb-3 text-sm font-medium">Who&apos;s coming where</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["Traditional only", "traditional", "var(--traditional)"],
              ["White only", "white", "var(--white-wedding)"],
              ["Both", "both", "var(--both)"],
              ["Undecided", "undecided", "var(--muted-foreground)"],
            ] as const
          ).map(([label, key, color]) => (
            <Link
              key={key}
              href={`/guests?attendance=${key}`}
              className="rounded-md p-1 transition-colors hover:bg-muted/40"
            >
              <p className="text-xs font-light text-muted-foreground">
                {label}
              </p>
              <p
                className="text-xl font-semibold tabular-nums"
                style={{ color }}
              >
                {stats?.attendance[key] ?? "—"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {stats?.perEvent.map((event) => {
          const meta = EVENTS[event.key as EventKey];
          const overCapacity =
            event.eventCapacity != null && event.attending > event.eventCapacity;
          return (
            <div key={event.key} className="rounded-md border bg-card p-5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", meta.dot)} />
                  <h2 className="text-sm font-medium">{event.name}</h2>
                </div>
                <EventEditor
                  eventKey={event.key as EventKey}
                  date={event.date}
                  venue={event.venue}
                  capacity={event.eventCapacity}
                />
              </div>
              <p className="mb-4 text-xs font-light text-muted-foreground">
                {[event.date, event.venue].filter(Boolean).join(" · ") ||
                  "No date or venue yet — guests will see these on their RSVP page"}
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-light text-muted-foreground">
                    Attending
                  </p>
                  <p
                    className={cn(
                      "text-xl font-semibold tabular-nums",
                      overCapacity && "text-destructive"
                    )}
                  >
                    {event.attending}
                    {event.eventCapacity != null && (
                      <span className="text-sm font-light text-muted-foreground">
                        {" "}
                        / {event.eventCapacity}
                      </span>
                    )}
                  </p>
                </div>
                <Link
                  href="/guests?view=seats"
                  className="rounded-md transition-colors hover:bg-muted/40"
                >
                  <p className="text-xs font-light text-muted-foreground">
                    Tables
                  </p>
                  <p className="text-xl font-semibold tabular-nums">
                    {event.tablesCount}
                  </p>
                </Link>
                <Link
                  href="/guests?view=seats"
                  className="rounded-md transition-colors hover:bg-muted/40"
                >
                  <p className="text-xs font-light text-muted-foreground">
                    Unseated
                  </p>
                  <p
                    className={cn(
                      "text-xl font-semibold tabular-nums",
                      event.unseated > 0 && "text-[var(--traditional)]"
                    )}
                  >
                    {event.unseated}
                  </p>
                </Link>
              </div>
              <p className="mt-4 text-xs font-light text-muted-foreground">
                {event.seated} of {event.tableCapacity} table seats used
              </p>
            </div>
          );
        })}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Scheduled messages</h2>
          <Link
            href="/messages"
            className="text-xs font-light text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Manage messages
          </Link>
        </div>
        {campaigns === undefined ? null : campaigns.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm font-light text-muted-foreground">
            Nothing scheduled —{" "}
            <Link
              href="/messages"
              className="underline underline-offset-2"
            >
              schedule your first message
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            {campaigns.map((c) => (
              <Link
                key={c._id}
                href="/messages"
                className="flex items-center justify-between gap-4 border-b px-4 py-2.5 text-sm last:border-b-0 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <span className="font-normal">{c.name}</span>
                  <span className="ml-2 text-xs font-light text-muted-foreground">
                    {c.groupName} ·{" "}
                    {new Date(c.sendAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs font-light text-muted-foreground tabular-nums">
                  {c.status !== "scheduled" && c.status !== "canceled" && (
                    <span>
                      {c.sentCount}/{c.recipients} sent · {c.openedCount}{" "}
                      opened · {c.repliedCount} replied
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-0 font-light",
                      c.status === "done"
                        ? "tone-both"
                        : c.status === "due"
                          ? "tone-traditional"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {c.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium">Recent sends</h2>
        {recent === undefined ? null : recent.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-center text-sm font-light text-muted-foreground">
            No messages yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            {recent.map((send) => (
              <div
                key={send._id}
                className="flex items-center justify-between gap-4 border-b px-4 py-2.5 text-sm last:border-b-0 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <span className="font-normal">{send.contactName}</span>
                  <span className="ml-2 truncate text-xs font-light text-muted-foreground">
                    {send.body.length > 60
                      ? send.body.slice(0, 60) + "…"
                      : send.body}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0 border-0 font-light",
                    send.status === "sent"
                      ? "tone-both"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {send.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
