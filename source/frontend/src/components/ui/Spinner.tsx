/**
 * Inline loading spinner for submit / action buttons. Uses the brand amber
 * accent by default; size adapts via the inherited font-size (w/h in em).
 */
export function Spinner({
  className = "",
  color = "text-amber-400",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={`inline-block w-[1.1em] h-[1.1em] rounded-full border-2 border-current border-t-transparent animate-spin align-middle ${color} ${className}`}
      role="status"
      aria-hidden="true"
    />
  );
}