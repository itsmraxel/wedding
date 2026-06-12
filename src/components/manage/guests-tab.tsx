"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ClipboardPaste,
  HeartPulse,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { groupColorStyle } from "@/lib/group-colors";
import { EventKey } from "@/lib/events";
import { cn } from "@/lib/utils";

type SeatInfo = { seatId: string; tableId: string; tableName: string } | null;
type ContactRow = Doc<"contacts"> & {
  groups: { _id: Id<"groups">; name: string; color?: string }[];
  traditionalSeat: SeatInfo;
  whiteSeat: SeatInfo;
};
type TableRowData = Doc<"tables"> & {
  guests: { seatId: string; contactId: string; name: string }[];
};
type GroupRowData = {
  _id: Id<"groups">;
  name: string;
  color?: string;
  memberCount: number;
};

function friendlyError(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  for (const marker of ["capacity:", "attendance:"]) {
    if (message.includes(marker)) {
      return message.split(marker)[1].split(" at ")[0];
    }
  }
  if (message.includes("full")) {
    const m = message.match(/Uncaught Error: ([^]*?) at handler/);
    return m ? m[1].trim() : "That table is full.";
  }
  return null;
}

/* ---------- Add / edit guest dialog (identity only — the rest is inline) ---------- */

function ContactDialog({
  contact,
  open,
  onOpenChange,
}: {
  contact: ContactRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addContact = useMutation(api.contacts.addContact);
  const updateContact = useMutation(api.contacts.updateContact);

  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");

  const save = async () => {
    if (!name.trim()) {
      toast.error("Every guest needs a name.");
      return;
    }
    try {
      if (contact) {
        await updateContact({
          contactId: contact._id,
          name: name.trim(),
          phone,
          notes: notes.trim() || undefined,
          // Groups and attendance are edited inline in the table.
          groupIds: contact.groupIds,
          attendance: contact.attendance,
        });
        toast.success(`${name.trim()} updated.`);
      } else {
        await addContact({
          name: name.trim(),
          phone,
          notes: notes.trim() || undefined,
          groupIds: [],
        });
        toast.success(
          `${name.trim()} added — set their group, attendance, and seat right in the table.`
        );
      }
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(
        message.includes("international")
          ? "That number doesn't look right — use the international format, e.g. +250788123456."
          : (friendlyError(err) ?? "Couldn't save the guest. Try again.")
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-medium">
            {contact ? "Edit guest" : "Add guest"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="name" className="text-xs font-light">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Guest name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone" className="text-xs font-light">
              WhatsApp number
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+250788123456"
            />
            <p className="text-xs font-light text-muted-foreground">
              International format, e.g. +250788123456
            </p>
          </div>
          {(contact?.allergies || contact?.specialRequests) && (
            <div className="rounded-md bg-muted/60 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-light text-muted-foreground">
                <HeartPulse className="size-3.5" /> Shared by the guest
              </p>
              {contact.allergies && (
                <p className="text-sm font-light">
                  <span className="text-muted-foreground">Allergies:</span>{" "}
                  {contact.allergies}
                </p>
              )}
              {contact.specialRequests && (
                <p className="text-sm font-light">
                  <span className="text-muted-foreground">Care needs:</span>{" "}
                  {contact.specialRequests}
                </p>
              )}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="notes" className="text-xs font-light">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Plus-one, arrives late, etc."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>
            {contact ? "Save changes" : "Add guest"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Bulk import dialog ---------- */

function ImportDialog() {
  const bulkAdd = useMutation(api.contacts.bulkAddContacts);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const parsed = useMemo(() => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,;\t]/).map((p) => p.trim());
        return {
          name: parts[0] ?? "",
          phone: parts[1] ?? "",
          groupNames: parts.slice(2).filter(Boolean),
        };
      });
  }, [text]);

  const runImport = async () => {
    if (parsed.length === 0) {
      toast.error("Paste at least one line first.");
      return;
    }
    const result = await bulkAdd({ entries: parsed });
    if (result.added > 0) {
      toast.success(
        `${result.added} ${result.added === 1 ? "guest" : "guests"} imported.`
      );
    }
    if (result.skipped.length > 0) {
      toast.warning(
        `${result.skipped.length} skipped: ${result.skipped
          .slice(0, 3)
          .map((s) => `${s.name} (${s.reason})`)
          .join(", ")}${result.skipped.length > 3 ? "…" : ""}`,
        { duration: 8000 }
      );
    }
    if (result.added > 0) {
      setText("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ClipboardPaste className="size-4" /> Import
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-medium">
            Import guests from a list
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <p className="text-xs font-light text-muted-foreground">
            One guest per line: <strong>Name, phone, groups…</strong> (commas,
            semicolons, or pasted spreadsheet columns all work). Groups are
            created automatically.
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="font-mono text-xs font-light"
            placeholder={`Aline Uwase, +250788111222, Family\nEric Mugisha, +250788333444, Friends`}
          />
          <p className="text-xs font-light text-muted-foreground">
            {parsed.length} {parsed.length === 1 ? "line" : "lines"} detected
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={runImport}>
            Import {parsed.length > 0 ? parsed.length : ""} guests
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Inline cells ---------- */

// Groups are assigned — and created — right from the cell's dropdown.
function GroupsCell({
  contact,
  groups,
}: {
  contact: ContactRow;
  groups: GroupRowData[];
}) {
  const updateContact = useMutation(api.contacts.updateContact);
  const addGroup = useMutation(api.groups.addGroup);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const setGroups = async (groupIds: Id<"groups">[]) => {
    await updateContact({
      contactId: contact._id,
      name: contact.name,
      phone: contact.phone,
      notes: contact.notes,
      attendance: contact.attendance,
      groupIds,
    });
  };

  const toggle = (id: Id<"groups">) =>
    setGroups(
      contact.groupIds.includes(id)
        ? contact.groupIds.filter((g) => g !== id)
        : [...contact.groupIds, id]
    );

  const createAndAssign = async () => {
    const name = newName.trim();
    if (!name) return;
    const existing = groups.find(
      (g) => g.name.toLowerCase() === name.toLowerCase()
    );
    const id = existing?._id ?? (await addGroup({ name }));
    if (!contact.groupIds.includes(id)) {
      await setGroups([...contact.groupIds, id]);
    }
    setNewName("");
    toast.success(existing ? `Added to ${existing.name}.` : `Group "${name}" created.`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex min-h-7 flex-wrap items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-muted/60"
          title="Edit groups"
        >
          {contact.groups.length === 0 ? (
            <span className="text-xs font-light text-muted-foreground">
              + Group
            </span>
          ) : (
            contact.groups.map((g) => (
              <Badge
                key={g._id}
                className="rounded-sm border-0 font-light"
                style={groupColorStyle(g.color)}
              >
                {g.name}
              </Badge>
            ))
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          {groups.map((group) => (
            <label
              key={group._id}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-sm font-light hover:bg-muted/60"
            >
              <Checkbox
                checked={contact.groupIds.includes(group._id)}
                onCheckedChange={() => toggle(group._id)}
              />
              <span
                className="rounded-sm px-1.5 py-0.5 text-xs"
                style={groupColorStyle(group.color)}
              >
                {group.name}
              </span>
            </label>
          ))}
          <div className="mt-1 flex items-center gap-1.5 border-t pt-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createAndAssign()}
              placeholder="New group…"
              className="h-7 flex-1 text-xs font-light"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={createAndAssign}
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const ATTENDANCE_STYLE: Record<string, string> = {
  traditional: "tone-traditional",
  white: "tone-white",
  both: "tone-both",
};

function AttendanceCell({ contact }: { contact: ContactRow }) {
  const setAttendance = useMutation(api.contacts.setAttendance);
  const value = contact.attendance ?? "undecided";
  return (
    <Select
      value={value}
      onValueChange={async (next) => {
        try {
          await setAttendance({
            contactId: contact._id,
            attendance:
              next === "undecided"
                ? undefined
                : (next as "traditional" | "white" | "both"),
          });
        } catch (err) {
          toast.error(friendlyError(err) ?? "Couldn't update attendance.");
        }
      }}
    >
      <SelectTrigger
        size="sm"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "h-7 w-fit gap-1 border-0 px-2 text-xs font-light shadow-none",
          value === "undecided"
            ? "bg-muted text-muted-foreground"
            : ATTENDANCE_STYLE[value]
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="undecided">Undecided</SelectItem>
        <SelectItem value="traditional">Traditional</SelectItem>
        <SelectItem value="white">White</SelectItem>
        <SelectItem value="both">Both</SelectItem>
      </SelectContent>
    </Select>
  );
}

// Seats are assigned — and tables created — right from the cell's dropdown.
function SeatCell({
  contact,
  eventKey,
  tables,
}: {
  contact: ContactRow;
  eventKey: EventKey;
  tables: TableRowData[];
}) {
  const assignSeat = useMutation(api.seating.assignSeat);
  const unassignSeat = useMutation(api.seating.unassignSeat);
  const addTable = useMutation(api.seating.addTable);
  const seat =
    eventKey === "traditional" ? contact.traditionalSeat : contact.whiteSeat;

  const attends =
    contact.attendance === undefined ||
    contact.attendance === "both" ||
    contact.attendance === eventKey;

  if (!attends) {
    return (
      <span
        className="text-xs font-light text-muted-foreground"
        title="Not attending this event"
      >
        —
      </span>
    );
  }

  const nextTableName = () => {
    const numbers = tables
      .map((t) => /^Table (\d+)$/.exec(t.name)?.[1])
      .filter(Boolean)
      .map(Number);
    return `Table ${numbers.length ? Math.max(...numbers) + 1 : 1}`;
  };

  return (
    <Select
      value={seat?.tableId ?? "none"}
      onValueChange={async (next) => {
        try {
          if (next === "none") {
            if (seat) await unassignSeat({ seatId: seat.seatId as Id<"seats"> });
          } else if (next === "__new__") {
            const name = nextTableName();
            const tableId = await addTable({ eventKey, name, capacity: 8 });
            await assignSeat({ contactId: contact._id, eventKey, tableId });
            toast.success(`${name} created — ${contact.name} seated there.`);
          } else {
            await assignSeat({
              contactId: contact._id,
              eventKey,
              tableId: next as Id<"tables">,
            });
          }
        } catch (err) {
          toast.error(friendlyError(err) ?? "Couldn't assign that seat.");
        }
      }}
    >
      <SelectTrigger
        size="sm"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "h-7 w-fit gap-1 border-0 px-2 text-xs font-light shadow-none",
          seat
            ? eventKey === "traditional"
              ? "tone-traditional"
              : "tone-white"
            : "bg-muted text-muted-foreground"
        )}
      >
        <SelectValue placeholder="No seat" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No seat</SelectItem>
        {tables.map((table) => {
          const full = table.guests.length >= table.capacity;
          const isCurrent = seat?.tableId === table._id;
          return (
            <SelectItem
              key={table._id}
              value={table._id}
              disabled={full && !isCurrent}
            >
              {table.name} · {table.guests.length}/{table.capacity}
              {full && !isCurrent ? " (full)" : ""}
            </SelectItem>
          );
        })}
        <SelectItem value="__new__">+ New table</SelectItem>
      </SelectContent>
    </Select>
  );
}

/* ---------- The guests view ---------- */

export function GuestsTab({
  initialAttendance,
}: {
  initialAttendance?: string;
}) {
  const contacts = useQuery(api.contacts.listContacts);
  const groupsData = useQuery(api.groups.listGroups);
  const traditionalTablesData = useQuery(api.seating.listTables, {
    eventKey: "traditional",
  });
  const whiteTablesData = useQuery(api.seating.listTables, {
    eventKey: "white",
  });
  const groups = useMemo(() => groupsData ?? [], [groupsData]);
  const traditionalTables = useMemo(
    () => traditionalTablesData ?? [],
    [traditionalTablesData]
  );
  const whiteTables = useMemo(() => whiteTablesData ?? [], [whiteTablesData]);
  const deleteContact = useMutation(api.contacts.deleteContact);
  const deleteGroup = useMutation(api.groups.deleteGroup);

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [attendanceFilter, setAttendanceFilter] = useState<string>(
    initialAttendance ?? "all"
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const data = useMemo(() => {
    let rows = contacts ?? [];
    if (groupFilter !== "all") {
      rows = rows.filter((c) =>
        c.groupIds.includes(groupFilter as Id<"groups">)
      );
    }
    if (attendanceFilter !== "all") {
      rows = rows.filter((c) =>
        attendanceFilter === "undecided"
          ? c.attendance === undefined
          : c.attendance === attendanceFilter
      );
    }
    return rows;
  }, [contacts, groupFilter, attendanceFilter]);

  const copyLink = (contact: ContactRow) => {
    const url = `${window.location.origin}/rsvp/${contact.token}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(`${contact.name}'s RSVP link copied.`),
      () => toast.error("Couldn't copy — your browser blocked it.")
    );
  };

  const columns = useMemo<ColumnDef<ContactRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Guest <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div>
            <p className="flex items-center gap-1.5 font-normal">
              {row.original.name}
              {(row.original.allergies || row.original.specialRequests) && (
                <HeartPulse
                  className="size-3.5 text-[var(--both)]"
                  aria-label="Shared health information"
                />
              )}
            </p>
            <p className="text-xs font-light text-muted-foreground tabular-nums">
              {row.original.phone}
            </p>
          </div>
        ),
      },
      {
        id: "groups",
        header: "Groups",
        cell: ({ row }) => <GroupsCell contact={row.original} groups={groups} />,
      },
      {
        accessorKey: "attendance",
        header: "Attending",
        cell: ({ row }) => <AttendanceCell contact={row.original} />,
      },
      {
        id: "traditionalSeat",
        header: "Traditional seat",
        cell: ({ row }) => (
          <SeatCell
            contact={row.original}
            eventKey="traditional"
            tables={traditionalTables}
          />
        ),
      },
      {
        id: "whiteSeat",
        header: "White seat",
        cell: ({ row }) => (
          <SeatCell
            contact={row.original}
            eventKey="white"
            tables={whiteTables}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Copy RSVP link"
              onClick={(e) => {
                e.stopPropagation();
                copyLink(row.original);
              }}
            >
              <Link2 className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Edit name & number"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(row.original);
                setDialogOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
            <ConfirmButton
              title={`Remove ${row.original.name}?`}
              description="Their seats and message history go too. This can't be undone."
              confirmLabel="Remove guest"
              onConfirm={async () => {
                await deleteContact({ contactId: row.original._id });
                toast.success(`${row.original.name} removed.`);
              }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                title="Delete guest"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </ConfirmButton>
          </div>
        ),
      },
    ],
    [deleteContact, groups, traditionalTables, whiteTables]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, value) => {
      const q = String(value).toLowerCase();
      return (
        row.original.name.toLowerCase().includes(q) ||
        row.original.phone.includes(q)
      );
    },
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const filteredGroup = groups.find((g) => g._id === groupFilter);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 basis-44">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests…"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger size="sm" className="w-36 font-light">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g._id} value={g._id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filteredGroup && (
          <ConfirmButton
            title={`Delete "${filteredGroup.name}"?`}
            description="Guests stay in your list — they just leave this group."
            onConfirm={async () => {
              await deleteGroup({ groupId: filteredGroup._id });
              setGroupFilter("all");
              toast.success(`Group "${filteredGroup.name}" deleted.`);
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              title={`Delete the "${filteredGroup.name}" group`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </ConfirmButton>
        )}
        <Select value={attendanceFilter} onValueChange={setAttendanceFilter}>
          <SelectTrigger size="sm" className="w-36 font-light">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All attendance</SelectItem>
            <SelectItem value="undecided">Undecided</SelectItem>
            <SelectItem value="traditional">Traditional</SelectItem>
            <SelectItem value="white">White</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <ImportDialog />
          <Button onClick={openNew}>
            <Plus className="size-4" /> Add guest
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-9 text-xs font-light text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {contacts === undefined ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-20 text-center text-sm font-light text-muted-foreground"
                >
                  Loading guests…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm font-light text-muted-foreground"
                >
                  {data.length === 0 && (contacts?.length ?? 0) > 0
                    ? "No guests match these filters."
                    : "No guests yet — add one, or import your list in one paste."}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="group/row cursor-pointer"
                  onClick={() => {
                    setEditing(row.original);
                    setDialogOpen(true);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
            <TableRow
              className="cursor-pointer hover:bg-muted/50"
              onClick={openNew}
            >
              <TableCell
                colSpan={columns.length}
                className="py-2 text-sm font-light text-muted-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <Plus className="size-3.5" /> New
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {dialogOpen && (
        <ContactDialog
          key={editing?._id ?? "new"}
          contact={editing}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}
