import type { LogEntry } from '@bgp/game-werewolf';

function names(playerIds: string[], nameOf: (playerId: string) => string): string {
  return playerIds.map(nameOf).join(', ');
}

function Entry({ entry, nameOf }: { entry: LogEntry; nameOf(playerId: string): string }) {
  if (entry.type === 'NIGHT') {
    return (
      <li>
        <strong>Đêm {entry.round}.</strong>{' '}
        {entry.deaths.length > 0
          ? `${names(entry.deaths, nameOf)} đã chết.`
          : 'Một đêm yên bình: không ai chết.'}
      </li>
    );
  }

  if (entry.type === 'SHOT') {
    const others = entry.deaths.filter((playerId) => playerId !== entry.targetId);
    return (
      <li>
        <strong>Thợ săn {nameOf(entry.hunterId)}</strong>{' '}
        {entry.targetId ? `bắn ${nameOf(entry.targetId)}.` : 'không bắn ai.'}
        {others.length > 0 && ` ${names(others, nameOf)} chết theo.`}
      </li>
    );
  }

  const others = entry.deaths.filter((playerId) => playerId !== entry.executedId);
  return (
    <li>
      <strong>Ngày {entry.round}.</strong> {entry.executedId === null && 'Làng không treo ai.'}
      {entry.executedId !== null &&
        (entry.spared
          ? `${nameOf(entry.executedId)} là Thằng ngốc: được tha, nhưng mất quyền bỏ phiếu.`
          : `Làng treo ${nameOf(entry.executedId)}.`)}
      {others.length > 0 && ` ${names(others, nameOf)} chết theo.`}
      {entry.powersLost && ' Già làng bị treo: các vai Dân mất hết năng lực.'}
      <details>
        <summary className="muted hint">Xem phiếu</summary>
        <ul className="werewolf-votes">
          {entry.votes.map((vote) => (
            <li key={vote.voterId}>
              {nameOf(vote.voterId)} → {vote.targetId ? nameOf(vote.targetId) : 'không treo ai'}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

/** What the whole table has been told so far, newest first. */
export function EventLog({ log, nameOf }: { log: LogEntry[]; nameOf(playerId: string): string }) {
  return (
    <section className="card" aria-label="Nhật ký">
      <h2>Nhật ký</h2>
      {log.length === 0 ? (
        <span className="muted">Chưa có gì xảy ra.</span>
      ) : (
        <ol className="werewolf-log" reversed>
          {[...log].reverse().map((entry, index) => (
            <Entry key={log.length - index} entry={entry} nameOf={nameOf} />
          ))}
        </ol>
      )}
    </section>
  );
}
