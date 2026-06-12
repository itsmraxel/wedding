export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      <p className="mb-1 text-xs font-light text-muted-foreground">
        Our Wedding / {title}
      </p>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm font-light text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}
