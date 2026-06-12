import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-5xl px-8 py-10 lg:px-12">{children}</div>
      </main>
    </div>
  );
}
