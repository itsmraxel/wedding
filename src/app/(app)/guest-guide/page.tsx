"use client";

import { PageHeader } from "@/components/page-header";
import { GuideTab } from "@/components/manage/guide-tab";

export default function GuestGuidePage() {
  return (
    <div>
      <PageHeader
        title="Guest guide"
        description="Stays and activities shown to guests on the public guide page."
      />
      <GuideTab />
    </div>
  );
}
