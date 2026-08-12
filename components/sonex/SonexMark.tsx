export function SonexMark({ className = '' }: { className?: string }) {
  return (
    <span aria-label="Sonex Dispatch" className={`grid h-9 w-9 grid-cols-3 gap-1 ${className}`}>
      <span className="col-span-2 bg-white" />
      <span className="bg-white/45" />
      <span className="bg-white/45" />
      <span className="col-span-2 bg-white" />
      <span className="col-span-2 bg-white" />
      <span className="bg-white/45" />
    </span>
  );
}
