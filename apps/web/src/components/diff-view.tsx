export function DiffView({ diff }: { diff: string }) {
  const lines = diff.split("\n").filter((l) => l.length > 0);
  return (
    <pre className="max-h-96 overflow-auto border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
      {lines.map((line, i) => (
        <div
          key={i}
          className={
            line.startsWith("+")
              ? "text-green-600 dark:text-green-400"
              : line.startsWith("-")
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
          }
        >
          {line}
        </div>
      ))}
    </pre>
  );
}
