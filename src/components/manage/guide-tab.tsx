"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BedDouble, Compass, ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { ConfirmButton } from "@/components/confirm-button";
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
import { Textarea } from "@/components/ui/textarea";

function AddItemDialog() {
  const addGuideItem = useMutation(api.guide.addGuideItem);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"stay" | "activity">("stay");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const save = async () => {
    if (!title.trim()) {
      toast.error("Give the suggestion a title.");
      return;
    }
    await addGuideItem({
      kind,
      title: title.trim(),
      description: description.trim() || undefined,
      url: url.trim() || undefined,
    });
    toast.success("Suggestion added.");
    setTitle("");
    setDescription("");
    setUrl("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add suggestion
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-medium">Add suggestion</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label className="text-xs font-light">Type</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as "stay" | "activity")}
            >
              <SelectTrigger className="w-full font-light">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stay">Place to stay</SelectItem>
                <SelectItem value="activity">Thing to do</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-light">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='e.g. "Kigali Marriott Hotel"'
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-light">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="A short note for guests"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-light">Link (optional)</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GuideTab() {
  const items = useQuery(api.guide.listGuideItems);
  const deleteGuideItem = useMutation(api.guide.deleteGuideItem);

  const stays = (items ?? []).filter((i) => i.kind === "stay");
  const activities = (items ?? []).filter((i) => i.kind === "activity");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs font-light text-muted-foreground">
          Guests see these at{" "}
          <code className="rounded-sm bg-background px-1">/guide</code> — send
          it via a scheduled &quot;Stay &amp; activities guide&quot; message.
        </p>
        <AddItemDialog />
      </div>

      {items !== undefined && items.length === 0 ? (
        <p className="rounded-md border border-dashed p-10 text-center text-sm font-light text-muted-foreground">
          No suggestions yet — add a place to stay or a thing to do.
        </p>
      ) : (
        <div className="space-y-6">
          {[
            { title: "Places to stay", icon: BedDouble, list: stays },
            { title: "Things to do", icon: Compass, list: activities },
          ].map(({ title, icon: Icon, list }) => (
            <section key={title}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4" strokeWidth={1.5} /> {title}
              </h2>
              {list.length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm font-light text-muted-foreground">
                  Nothing here yet.
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  {list.map((item) => (
                    <div
                      key={item._id}
                      className="group/row flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0 hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-normal">{item.title}</p>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-0.5 text-xs font-light text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            >
                              link <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                        {item.description && (
                          <p className="mt-0.5 text-xs font-light text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <ConfirmButton
                        title={`Remove "${item.title}"?`}
                        description="It disappears from the guest guide immediately."
                        onConfirm={async () => {
                          await deleteGuideItem({ itemId: item._id });
                          toast.success("Suggestion removed.");
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/row:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </ConfirmButton>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
