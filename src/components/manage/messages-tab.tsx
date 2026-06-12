"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EVENTS, EventKey } from "@/lib/events";
import { cn } from "@/lib/utils";

const DEFAULT_BODY =
  "Hi {name}! You're seated at {table} for the {event}. Please show this table number to the protocol team at the entrance. See you there 🎉";

type MessageKind = "invite" | "reminder" | "guide" | "custom";

const KIND_TEMPLATES: Record<
  MessageKind,
  { label: string; body: string; hint: string }
> = {
  invite: {
    label: "Invitation",
    body: "Hi {name}! We're overjoyed to invite you to celebrate our wedding with us 💍 More details to follow soon!",
    hint: "Guests without a wedding assigned automatically get a link with the two choice buttons.",
  },
  reminder: {
    label: "Reminder + care form",
    body: "Hi {name}! Our wedding is coming up soon 🎉 So we can take good care of you, please tell us about any allergies or health needs here: {link}",
    hint: "{link} resolves to each guest's personal allergies & care-needs form.",
  },
  guide: {
    label: "Stay & activities guide",
    body: "Hi {name}! The big day is almost here ✨ Here are our suggestions for places to stay and things to do: {link}",
    hint: "{link} resolves to the public guest guide page.",
  },
  custom: {
    label: "Custom",
    body: "",
    hint: "Plain message — supports {name}, {table}, {event}.",
  },
};

function waLink(phone: string, body: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

/* ---------- One-tap send row ---------- */

// "Send on WhatsApp" opens the chat AND marks the row sent in one tap.
// A toast offers undo in case WhatsApp didn't actually open.
function SendActions({
  phone,
  body,
  name,
  onSent,
  onUndo,
}: {
  phone: string;
  body: string;
  name: string;
  onSent: () => Promise<unknown> | void;
  onUndo: () => Promise<unknown> | void;
}) {
  return (
    <Button variant="outline" size="sm" asChild className="font-light">
      <a
        href={waLink(phone, body)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          void onSent();
          toast.success(`Sent to ${name}.`, {
            action: { label: "Undo", onClick: () => void onUndo() },
          });
        }}
      >
        <ExternalLink className="size-3.5" /> Send on WhatsApp
      </a>
    </Button>
  );
}

/* ---------- Scheduling ---------- */

function ScheduleDialog({
  groups,
}: {
  groups: { _id: Id<"groups">; name: string }[];
}) {
  const scheduleMessage = useMutation(api.scheduled.scheduleMessage);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MessageKind>("invite");
  const [groupId, setGroupId] = useState<string>("everyone");
  const [eventChoice, setEventChoice] = useState<string>("none");
  const [sendAt, setSendAt] = useState("");
  const [body, setBody] = useState(KIND_TEMPLATES.invite.body);

  const pickKind = (k: MessageKind) => {
    setKind(k);
    setBody(KIND_TEMPLATES[k].body);
    if (!name) setName(KIND_TEMPLATES[k].label);
  };

  const save = async () => {
    const ts = sendAt ? new Date(sendAt).getTime() : NaN;
    if (!name.trim() || !body.trim() || !Number.isFinite(ts)) {
      toast.error("Give the message a name, a body, and a date & time.");
      return;
    }
    if (ts <= Date.now()) {
      toast.error("Pick a time in the future.");
      return;
    }
    try {
      await scheduleMessage({
        name: name.trim(),
        kind,
        body: body.trim(),
        groupId:
          groupId === "everyone" ? undefined : (groupId as Id<"groups">),
        eventKey:
          eventChoice === "none" ? undefined : (eventChoice as EventKey),
        sendAt: ts,
      });
      toast.success(
        `"${name.trim()}" scheduled for ${new Date(ts).toLocaleString()}.`
      );
      setOpen(false);
      setName("");
      setSendAt("");
      pickKind("invite");
    } catch {
      toast.error("Couldn't schedule the message. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Schedule message
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-medium">Schedule a message</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs font-light">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "Save the date"'
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-light">Type</Label>
              <Select
                value={kind}
                onValueChange={(v) => pickKind(v as MessageKind)}
              >
                <SelectTrigger className="w-full font-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_TEMPLATES) as MessageKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_TEMPLATES[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs font-light">Audience</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="w-full font-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g._id} value={g._id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-light">
                Event context for {"{table}"}/{"{event}"}
              </Label>
              <Select value={eventChoice} onValueChange={setEventChoice}>
                <SelectTrigger className="w-full font-light">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="traditional">
                    Traditional Wedding
                  </SelectItem>
                  <SelectItem value="white">White Wedding</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-light">Send on</Label>
            <Input
              type="datetime-local"
              value={sendAt}
              onChange={(e) => setSendAt(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-light">Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="font-light"
            />
            <p className="text-xs font-light text-muted-foreground">
              {KIND_TEMPLATES[kind].hint}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DueQueue({
  scheduledMessageId,
}: {
  scheduledMessageId: Id<"scheduledMessages">;
}) {
  const sends = useQuery(api.scheduled.dueSends, { scheduledMessageId });
  const markSent = useMutation(api.sends.markSent);
  const unmarkSent = useMutation(api.sends.unmarkSent);
  if (sends === undefined) return null;

  const pending = sends.filter((s) => s.status === "pending");
  const done = sends.filter((s) => s.status === "sent");

  return (
    <div className="mt-1 overflow-hidden rounded-md border">
      {[...pending, ...done].map((send) => (
        <div
          key={send._id}
          className={cn(
            "flex items-center justify-between gap-4 border-b px-4 py-2.5 last:border-b-0",
            send.status === "sent" && "bg-muted/40"
          )}
        >
          <div className="min-w-0">
            <p className="text-sm font-normal">{send.contactName}</p>
            <p className="truncate text-xs font-light text-muted-foreground">
              {send.body}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {send.openedAt != null && (
              <span className="text-xs font-light text-muted-foreground">
                opened
              </span>
            )}
            {send.repliedAt != null && (
              <Badge className="tone-both rounded-sm border-0 font-light">
                replied
              </Badge>
            )}
            {send.status === "sent" ? (
              <Badge
                variant="outline"
                className="rounded-sm border-0 bg-muted font-light text-muted-foreground"
              >
                <Check className="size-3" /> sent
              </Badge>
            ) : (
              <SendActions
                phone={send.phone}
                body={send.body}
                name={send.contactName}
                onSent={() => markSent({ sendId: send._id })}
                onUndo={() => unmarkSent({ sendId: send._id })}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduledSection({
  groups,
}: {
  groups: { _id: Id<"groups">; name: string }[];
}) {
  const campaigns = useQuery(api.scheduled.listScheduled);
  const cancelScheduled = useMutation(api.scheduled.cancelScheduled);
  const deleteScheduled = useMutation(api.scheduled.deleteScheduled);
  const nudge = useMutation(api.scheduled.nudge);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="rounded-md border bg-card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <CalendarClock className="size-4" strokeWidth={1.5} /> Scheduled
          messages
        </h2>
        <ScheduleDialog groups={groups} />
      </div>
      <p className="mb-4 text-xs font-light text-muted-foreground">
        Messages fire at their scheduled time and queue up here, personalized
        per guest. Tapping &quot;Send on WhatsApp&quot; marks the row sent
        automatically.
      </p>

      {campaigns === undefined ? null : campaigns.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm font-light text-muted-foreground">
          Nothing scheduled yet — schedule your invitation.
        </p>
      ) : (
        <div className="space-y-1">
          {campaigns.map((c) => {
            const isOpen = expanded === c._id;
            const expandable = c.status === "due" || c.status === "done";
            return (
              <div key={c._id} className="rounded-md border">
                <div
                  className={cn(
                    "flex items-center justify-between gap-4 px-3 py-2.5",
                    expandable && "cursor-pointer hover:bg-muted/40"
                  )}
                  onClick={() =>
                    expandable && setExpanded(isOpen ? null : c._id)
                  }
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {expandable ? (
                      isOpen ? (
                        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                      )
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-normal">
                        {c.name}
                        <span className="ml-2 text-xs font-light text-muted-foreground">
                          {KIND_TEMPLATES[c.kind as MessageKind].label} ·{" "}
                          {c.groupName} ·{" "}
                          {new Date(c.sendAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs font-light text-muted-foreground tabular-nums">
                    {expandable && (
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
                    {expandable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 font-light text-muted-foreground"
                        title="Re-queue this message for everyone who hasn't responded"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const result = await nudge({ id: c._id });
                          toast.success(
                            result.queued === 0
                              ? "Everyone has responded — nothing to nudge 🎉"
                              : `Nudge queued for ${result.queued} ${result.queued === 1 ? "guest" : "guests"}.`
                          );
                        }}
                      >
                        <BellRing className="size-3" /> Nudge
                      </Button>
                    )}
                    {c.status === "scheduled" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        title="Cancel scheduled message"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await cancelScheduled({ id: c._id });
                          toast.success(`"${c.name}" canceled.`);
                        }}
                      >
                        <X className="size-3.5" />
                      </Button>
                    ) : (
                      <ConfirmButton
                        title={`Delete "${c.name}"?`}
                        description="Its send history and tracking disappear from the dashboard too."
                        onConfirm={async () => {
                          await deleteScheduled({ id: c._id });
                          toast.success(`"${c.name}" removed.`);
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          title="Delete from list"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </ConfirmButton>
                    )}
                  </div>
                </div>
                {isOpen && expandable && (
                  <div className="px-3 pb-3">
                    <DueQueue scheduledMessageId={c._id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- Send now ---------- */

type GeneratedRow = {
  sendId: Id<"sends">;
  contactId: Id<"contacts">;
  name: string;
  phone: string;
  body: string;
};

function SendNow() {
  const contacts = useQuery(api.contacts.listContacts);
  const groups = useQuery(api.groups.listGroups) ?? [];
  const logSends = useMutation(api.sends.logSends);
  const markSent = useMutation(api.sends.markSent);
  const unmarkSent = useMutation(api.sends.unmarkSent);

  const [audience, setAudience] = useState<string>("everyone");
  const [eventChoice, setEventChoice] = useState<string>("traditional");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [generated, setGenerated] = useState<GeneratedRow[] | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const eventKey: EventKey | null =
    eventChoice === "none" ? null : (eventChoice as EventKey);

  const recipients = useMemo(() => {
    let list = contacts ?? [];
    if (audience !== "everyone") {
      list = list.filter((c) => c.groupIds.includes(audience as Id<"groups">));
    }
    return list;
  }, [contacts, audience]);

  const seatFor = (contact: (typeof recipients)[number]) =>
    eventKey === "traditional"
      ? (contact.traditionalSeat?.tableName ?? null)
      : eventKey === "white"
        ? (contact.whiteSeat?.tableName ?? null)
        : null;

  const unseatedRecipients = eventKey
    ? recipients.filter((c) => seatFor(c) === null)
    : [];

  const included = recipients.filter((c) => !skipped.has(c._id));

  const resolve = (contact: (typeof recipients)[number]) =>
    body
      .replaceAll("{name}", contact.name)
      .replaceAll("{table}", seatFor(contact) ?? "—")
      .replaceAll("{event}", eventKey ? EVENTS[eventKey].label : "—");

  const insertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => b + variable);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = body.slice(0, start) + variable + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    });
  };

  const toggleSkip = (id: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const generate = async () => {
    if (included.length === 0) {
      toast.error("No recipients selected — pick a group with members.");
      return;
    }
    const rows = included.map((c) => ({
      contactId: c._id,
      name: c.name,
      phone: c.phone,
      body: resolve(c),
    }));
    const ids = await logSends({
      recipients: rows.map(({ contactId, body }) => ({ contactId, body })),
      channel: "wa_link",
      eventKey: eventKey ?? undefined,
    });
    setGenerated(rows.map((row, i) => ({ ...row, sendId: ids[i] })));
    setSentIds(new Set());
    toast.success(
      `${rows.length} ${rows.length === 1 ? "message" : "messages"} ready to send.`
    );
  };

  const previewContact = included[0];

  return (
    <div className="space-y-6">
      <section className="rounded-md border bg-card p-5">
        <h2 className="mb-1 text-sm font-medium">1 · Audience</h2>
        <p className="mb-3 text-xs font-light text-muted-foreground">
          Who should receive this message?
        </p>
        <div className="flex items-center gap-3">
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger className="w-56 font-light">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g._id} value={g._id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-light text-muted-foreground">
            {recipients.length}{" "}
            {recipients.length === 1 ? "recipient" : "recipients"}
          </span>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5">
        <h2 className="mb-1 text-sm font-medium">2 · Event context</h2>
        <p className="mb-3 text-xs font-light text-muted-foreground">
          Determines how {"{table}"} and {"{event}"} resolve.
        </p>
        <Select value={eventChoice} onValueChange={setEventChoice}>
          <SelectTrigger className="w-56 font-light">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="traditional">Traditional Wedding</SelectItem>
            <SelectItem value="white">White Wedding</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>

        {unseatedRecipients.length > 0 && (
          <div className="mt-4 rounded-md border border-[var(--traditional)]/30 bg-[var(--traditional-bg)]/50 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-normal text-[var(--traditional)]">
              <AlertTriangle className="size-3.5" />
              {unseatedRecipients.length}{" "}
              {unseatedRecipients.length === 1
                ? "recipient has"
                : "recipients have"}{" "}
              no seat for the {eventKey && EVENTS[eventKey].label} — skip them,
              or include them without a table.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unseatedRecipients.map((c) => {
                const isSkipped = skipped.has(c._id);
                return (
                  <button
                    key={c._id}
                    onClick={() => toggleSkip(c._id)}
                    title={isSkipped ? "Click to include" : "Click to skip"}
                    className={cn(
                      "rounded-sm border px-2 py-0.5 text-xs font-light transition-colors",
                      isSkipped
                        ? "border-transparent bg-muted text-muted-foreground line-through"
                        : "border-[var(--traditional)]/40 bg-white"
                    )}
                  >
                    {c.name}
                    {isSkipped ? " · skipped" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-md border bg-card p-5">
        <h2 className="mb-1 text-sm font-medium">3 · Message</h2>
        <p className="mb-3 text-xs font-light text-muted-foreground">
          Use the variables below — each guest gets a personalized copy.
        </p>
        <div className="mb-2 flex gap-1.5">
          {["{name}", "{table}", "{event}"].map((variable) => (
            <Button
              key={variable}
              variant="outline"
              size="sm"
              className="h-6 rounded-sm px-2 font-mono text-xs font-light"
              onClick={() => insertVariable(variable)}
            >
              {variable}
            </Button>
          ))}
        </div>
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="font-light"
        />
        {previewContact && (
          <div className="mt-3 rounded-md bg-muted/60 p-3">
            <Label className="mb-1 block text-xs font-light text-muted-foreground">
              Preview for {previewContact.name}
            </Label>
            <p className="text-sm font-light">{resolve(previewContact)}</p>
          </div>
        )}
        <Button className="mt-4" onClick={generate}>
          <Send className="size-4" />
          Generate WhatsApp messages ({included.length})
        </Button>
      </section>

      {generated && (
        <section className="rounded-md border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Ready to send</h2>
            <span className="text-xs font-light text-muted-foreground">
              {sentIds.size} of {generated.length} sent
            </span>
          </div>
          <div className="overflow-hidden rounded-md border">
            {generated.map((row) => {
              const sent = sentIds.has(row.sendId);
              return (
                <div
                  key={row.sendId}
                  className={cn(
                    "flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0",
                    sent && "bg-muted/40"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-normal">{row.name}</p>
                    <p className="truncate text-xs font-light text-muted-foreground">
                      {row.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {sent ? (
                      <Badge className="tone-both rounded-sm border-0 font-light">
                        <Check className="size-3" /> Sent
                      </Badge>
                    ) : (
                      <SendActions
                        phone={row.phone}
                        body={row.body}
                        name={row.name}
                        onSent={async () => {
                          await markSent({ sendId: row.sendId });
                          setSentIds((prev) =>
                            new Set(prev).add(row.sendId)
                          );
                        }}
                        onUndo={async () => {
                          await unmarkSent({ sendId: row.sendId });
                          setSentIds((prev) => {
                            const next = new Set(prev);
                            next.delete(row.sendId);
                            return next;
                          });
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export function MessagesTab() {
  const groups = useQuery(api.groups.listGroups) ?? [];

  return (
    <Tabs defaultValue="schedule">
      <TabsList className="mb-4">
        <TabsTrigger value="schedule" className="gap-2 font-light">
          <CalendarClock className="size-4" strokeWidth={1.5} /> Schedule
        </TabsTrigger>
        <TabsTrigger value="now" className="gap-2 font-light">
          <Send className="size-4" strokeWidth={1.5} /> Send now
        </TabsTrigger>
      </TabsList>
      <TabsContent value="schedule">
        <ScheduledSection groups={groups} />
      </TabsContent>
      <TabsContent value="now">
        <SendNow />
      </TabsContent>
    </Tabs>
  );
}
