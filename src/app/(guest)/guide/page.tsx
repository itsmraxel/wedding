"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { BedDouble, Compass, ExternalLink } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

export default function GuidePage() {
  return (
    <Suspense>
      <GuideInner />
    </Suspense>
  );
}

function GuideInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t");
  const sendId = searchParams.get("s") as Id<"sends"> | null;

  const items = useQuery(api.guest.listGuide);
  const markOpened = useMutation(api.guest.markOpened);

  useEffect(() => {
    if (token && sendId) void markOpened({ token, sendId });
  }, [token, sendId, markOpened]);

  const stays = (items ?? []).filter((i) => i.kind === "stay");
  const activities = (items ?? []).filter((i) => i.kind === "activity");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-lg py-8">
        <h1 className="mb-1 text-center text-2xl font-semibold">
          Your guide to the celebrations 🎉
        </h1>
        <p className="mb-8 text-center text-sm font-light text-muted-foreground">
          Our suggestions for places to stay and things to do while
          you&apos;re here.
        </p>

        {items !== undefined && items.length === 0 && (
          <p className="rounded-md border border-dashed bg-card p-8 text-center text-sm font-light text-muted-foreground">
            The couple hasn&apos;t added suggestions yet — check back soon!
          </p>
        )}

        {[
          { title: "Places to stay", icon: BedDouble, list: stays },
          { title: "Things to do", icon: Compass, list: activities },
        ].map(
          ({ title, icon: Icon, list }) =>
            list.length > 0 && (
              <section key={title} className="mb-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-4" strokeWidth={1.5} /> {title}
                </h2>
                <div className="overflow-hidden rounded-md border bg-card">
                  {list.map((item) => (
                    <div
                      key={item._id}
                      className="border-b px-4 py-3 last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-normal">{item.title}</p>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1 text-xs font-light text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          >
                            Open <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-0.5 text-xs font-light text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )
        )}
      </div>
    </div>
  );
}
