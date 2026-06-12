"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Armchair, Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EVENTS, EventKey } from "@/lib/events";
import { cn } from "@/lib/utils";

function TableDialog({
  eventKey,
  table,
  open,
  onOpenChange,
}: {
  eventKey: EventKey;
  table: Doc<"tables"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addTable = useMutation(api.seating.addTable);
  const updateTable = useMutation(api.seating.updateTable);
  const [name, setName] = useState(table?.name ?? "");
  const [capacity, setCapacity] = useState(table?.capacity.toString() ?? "8");

  const save = async () => {
    const cap = parseInt(capacity, 10);
    if (!name.trim() || !Number.isFinite(cap) || cap < 1) {
      toast.error("Give the table a name and a capacity of at least 1.");
      return;
    }
    try {
      if (table) {
        await updateTable({ tableId: table._id, name: name.trim(), capacity: cap });
        toast.success(`${name.trim()} updated.`);
      } else {
        await addTable({ eventKey, name: name.trim(), capacity: cap });
        toast.success(`${name.trim()} added to the ${EVENTS[eventKey].label}.`);
      }
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(
        message.includes("already seated")
          ? "More guests are seated here than the new capacity — unseat some first."
          : "Couldn't save the table."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-medium">
            {table ? `Edit ${table.name}` : `Add table — ${EVENTS[eventKey].label}`}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label className="text-xs font-light">Table name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Table 2" or "Family table"'
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-light">Capacity</Label>
            <Input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>{table ? "Save" : "Add table"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignSeatPopover({
  eventKey,
  tableId,
  tableName,
  full,
}: {
  eventKey: EventKey;
  tableId: Id<"tables">;
  tableName: string;
  full: boolean;
}) {
  const contacts = useQuery(api.contacts.listContacts) ?? [];
  const assignSeat = useMutation(api.seating.assignSeat);
  const [open, setOpen] = useState(false);

  // Unseated for this event, and not attending only the other one.
  const candidates = contacts.filter((c) => {
    const seat = eventKey === "traditional" ? c.traditionalSeat : c.whiteSeat;
    const attends =
      c.attendance === undefined ||
      c.attendance === "both" ||
      c.attendance === eventKey;
    return seat === null && attends;
  });

  const assign = async (contactId: Id<"contacts">, name: string) => {
    try {
      await assignSeat({ contactId, eventKey, tableId });
      toast.success(`${name} seated at ${tableName}.`);
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message.includes("full")
          ? `${tableName} is already full — pick another table or raise its capacity.`
          : "Couldn't assign that seat. Try again."
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start font-light text-muted-foreground"
          disabled={full}
        >
          <UserPlus className="size-3.5" />
          {full ? "Table full" : "Assign seat"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Find an unseated guest…" />
          <CommandList>
            <CommandEmpty className="p-3 text-sm font-light text-muted-foreground">
              Everyone attending is seated.
            </CommandEmpty>
            <CommandGroup>
              {candidates.map((contact) => (
                <CommandItem
                  key={contact._id}
                  value={contact.name}
                  onSelect={() => assign(contact._id, contact.name)}
                  className="font-light"
                >
                  {contact.name}
                  {contact.attendance === undefined && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      undecided
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function EventSeating({ eventKey }: { eventKey: EventKey }) {
  const tables = useQuery(api.seating.listTables, { eventKey });
  const unassignSeat = useMutation(api.seating.unassignSeat);
  const deleteTable = useMutation(api.seating.deleteTable);
  const meta = EVENTS[eventKey];
  const [editing, setEditing] = useState<Doc<"tables"> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (tables === undefined) {
    return (
      <p className="py-12 text-center text-sm font-light text-muted-foreground">
        Loading tables…
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-light text-muted-foreground">
          {tables.length} {tables.length === 1 ? "table" : "tables"} ·{" "}
          {tables.reduce((sum, t) => sum + t.guests.length, 0)} guests seated
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" /> Add table
        </Button>
      </div>

      {tables.length === 0 ? (
        <p className="rounded-md border border-dashed p-10 text-center text-sm font-light text-muted-foreground">
          No tables yet for the {meta.label.toLowerCase()} — add your first
          table.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => {
            const full = table.guests.length >= table.capacity;
            return (
              <div
                key={table._id}
                className="group/card rounded-md border bg-card p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", meta.dot)} />
                    <h3 className="text-sm font-medium">{table.name}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "rounded-sm px-1.5 py-0.5 text-xs font-light tabular-nums",
                        full ? "tone-both" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {table.guests.length} / {table.capacity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 opacity-0 transition-opacity group-hover/card:opacity-100"
                      title="Edit table"
                      onClick={() => {
                        setEditing(table);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5 text-muted-foreground" />
                    </Button>
                    <ConfirmButton
                      title={`Delete ${table.name}?`}
                      description={
                        table.guests.length > 0
                          ? `${table.guests.length} seated ${table.guests.length === 1 ? "guest" : "guests"} will be unseated.`
                          : "This table is empty."
                      }
                      onConfirm={async () => {
                        await deleteTable({ tableId: table._id });
                        toast.success(`${table.name} removed.`);
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 opacity-0 transition-opacity group-hover/card:opacity-100"
                        title="Delete table"
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </ConfirmButton>
                  </div>
                </div>

                <ul className="mb-2 min-h-8 space-y-0.5">
                  {table.guests.length === 0 && (
                    <li className="flex items-center gap-1.5 py-1 text-xs font-light text-muted-foreground">
                      <Armchair className="size-3.5" /> No one seated yet
                    </li>
                  )}
                  {table.guests.map((guest) => (
                    <li
                      key={guest.seatId}
                      className="group/guest flex items-center justify-between rounded-sm px-1.5 py-1 text-sm font-light hover:bg-muted/60"
                    >
                      {guest.name}
                      <button
                        title={`Remove ${guest.name} from ${table.name}`}
                        className="opacity-0 transition-opacity group-hover/guest:opacity-100"
                        onClick={async () => {
                          await unassignSeat({
                            seatId: guest.seatId as Id<"seats">,
                          });
                          toast.success(`${guest.name} unseated.`);
                        }}
                      >
                        <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>

                <AssignSeatPopover
                  eventKey={eventKey}
                  tableId={table._id}
                  tableName={table.name}
                  full={full}
                />
              </div>
            );
          })}
        </div>
      )}

      {dialogOpen && (
        <TableDialog
          key={editing?._id ?? "new"}
          eventKey={eventKey}
          table={editing}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}

export function TablesTab() {
  return (
    <Tabs defaultValue="traditional">
      <TabsList className="mb-4">
        <TabsTrigger value="traditional" className="gap-2 font-light">
          <span className={cn("size-2 rounded-full", EVENTS.traditional.dot)} />
          Traditional Wedding
        </TabsTrigger>
        <TabsTrigger value="white" className="gap-2 font-light">
          <span className={cn("size-2 rounded-full", EVENTS.white.dot)} />
          White Wedding
        </TabsTrigger>
      </TabsList>
      <TabsContent value="traditional">
        <EventSeating eventKey="traditional" />
      </TabsContent>
      <TabsContent value="white">
        <EventSeating eventKey="white" />
      </TabsContent>
    </Tabs>
  );
}
