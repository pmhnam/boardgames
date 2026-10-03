export function UnsupportedGame({ gameType }: { gameType: string }) {
  return <p className="error">This client cannot display “{gameType}” yet.</p>;
}
