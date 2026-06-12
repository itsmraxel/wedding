"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Check } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function DetailsPage() {
  return (
    <Suspense>
      <DetailsInner />
    </Suspense>
  );
}

function DetailsInner() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const sendId = searchParams.get("s") as Id<"sends"> | null;

  const guest = useQuery(api.guest.getByToken, { token });
  const markOpened = useMutation(api.guest.markOpened);

  useEffect(() => {
    if (sendId) void markOpened({ token, sendId });
  }, [token, sendId, markOpened]);

  if (guest === undefined) {
    return (
      <Shell>
        <p className="text-sm font-light text-muted-foreground">Loading…</p>
      </Shell>
    );
  }
  if (guest === null) {
    return (
      <Shell>
        <p className="text-sm font-light text-muted-foreground">
          This link isn&apos;t valid. Please check the message you received.
        </p>
      </Shell>
    );
  }

  // Keyed on token so state initializes from the loaded guest record.
  return (
    <DetailsForm
      key={token}
      token={token}
      sendId={sendId}
      name={guest.name}
      initialAllergies={guest.allergies}
      initialRequests={guest.specialRequests}
    />
  );
}

function DetailsForm({
  token,
  sendId,
  name,
  initialAllergies,
  initialRequests,
}: {
  token: string;
  sendId: Id<"sends"> | null;
  name: string;
  initialAllergies: string;
  initialRequests: string;
}) {
  const submitDetails = useMutation(api.guest.submitDetails);
  const [allergies, setAllergies] = useState(initialAllergies);
  const [requests, setRequests] = useState(initialRequests);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <Shell>
        <Check className="mx-auto mb-3 size-8 text-[var(--both)]" />
        <h1 className="mb-2 text-2xl font-semibold">Thank you, {name}!</h1>
        <p className="text-sm font-light text-muted-foreground">
          We&apos;ve noted everything. We&apos;ll make sure you&apos;re well
          taken care of on the day 💛
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-semibold">Hi {name} 👋</h1>
      <p className="mb-6 text-sm font-light text-muted-foreground">
        Help us take good care of you on the day — tell us about anything we
        should prepare for.
      </p>
      <div className="grid gap-4 text-left">
        <div className="grid gap-1.5">
          <Label htmlFor="allergies" className="text-xs font-light">
            Allergies or dietary restrictions
          </Label>
          <Textarea
            id="allergies"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="e.g. peanut allergy, vegetarian, no alcohol…"
            rows={2}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="requests" className="text-xs font-light">
            Health conditions or special care needs
          </Label>
          <Textarea
            id="requests"
            value={requests}
            onChange={(e) => setRequests(e.target.value)}
            placeholder="e.g. diabetes, reduced mobility, epilepsy — anything we should be ready for"
            rows={2}
          />
        </div>
        <Button
          onClick={async () => {
            await submitDetails({
              token,
              allergies,
              specialRequests: requests,
              sendId: sendId ?? undefined,
            });
            setSubmitted(true);
          }}
        >
          Send to the couple
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fbfbfa] p-6">
      <div className="w-full max-w-sm rounded-md border bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}
