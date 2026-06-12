"use client";

import { PageHeader } from "@/components/page-header";
import { MessagesTab } from "@/components/manage/messages-tab";

export default function MessagesPage() {
  return (
    <div>
      <PageHeader
        title="Messages"
        description="Schedule invitations and reminders, or send table numbers now."
      />
      <MessagesTab />
    </div>
  );
}
