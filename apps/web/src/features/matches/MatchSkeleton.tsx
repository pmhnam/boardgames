/** The shape of a board while the match, or its replay, is on its way. */
export function MatchSkeleton({ label }: { label: string }) {
  return (
    <div className="stack" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <div className="match-skeleton-bar skeleton" aria-hidden="true" />
      <div className="match-skeleton-board skeleton" aria-hidden="true" />
    </div>
  );
}
