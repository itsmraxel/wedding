"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Armchair, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuestsTab } from "@/components/manage/guests-tab";
import { TablesTab } from "@/components/manage/tables-tab";

export default function GuestsPage() {
  return (
    <Suspense>
      <GuestsInner />
    </Suspense>
  );
}

function GuestsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "seats" ? "seats" : "guests";
  const attendance = searchParams.get("attendance") ?? undefined;

  return (
    <div>
      <PageHeader
        title="Guests"
        description="Everyone invited — groups, attendance, and seats are edited right in the table."
      />
      <Tabs
        value={view}
        onValueChange={(next) =>
          router.replace(next === "seats" ? "/guests?view=seats" : "/guests")
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="guests" className="gap-2 font-light">
            <Users className="size-4" strokeWidth={1.5} /> Guests
          </TabsTrigger>
          <TabsTrigger value="seats" className="gap-2 font-light">
            <Armchair className="size-4" strokeWidth={1.5} /> Seats
          </TabsTrigger>
        </TabsList>
        <TabsContent value="guests">
          {/* Keyed so dashboard deep-links (e.g. ?attendance=undecided) re-init the filter */}
          <GuestsTab key={attendance ?? "all"} initialAttendance={attendance} />
        </TabsContent>
        <TabsContent value="seats">
          <TablesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
