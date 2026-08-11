export function DatatruckMark({ className = '' }: { className?: string }) {
  return (
    <span aria-label="Sonex" className={`relative inline-block h-9 w-9 ${className}`}>
      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white" />
      <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-white" />
      <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-white" />
      <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 bg-white" />
      <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 bg-white" />
      <span className="absolute left-1/4 top-1/4 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white" />
      <span className="absolute right-1/4 top-1/4 h-1 w-1 translate-x-1/2 -translate-y-1/2 rotate-45 bg-white" />
      <span className="absolute bottom-1/4 left-1/4 h-1 w-1 -translate-x-1/2 translate-y-1/2 rotate-45 bg-white" />
      <span className="absolute bottom-1/4 right-1/4 h-1 w-1 translate-x-1/2 translate-y-1/2 rotate-45 bg-white" />
    </span>
  );
}
