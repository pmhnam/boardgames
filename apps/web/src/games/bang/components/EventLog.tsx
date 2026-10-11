import type { LogEntryView } from '@bgp/game-bang';
import { groupByTurn, logIcon } from '../log';
import type { NameOf } from '../text';
import { useBangText } from '../useBangText';
import { Icon } from './Icon';

/** What the table has seen happen, the latest turn first and the latest thing first in it. */
export function EventLog({ log, nameOf }: { log: LogEntryView[]; nameOf: NameOf }) {
  const text = useBangText();
  const turns = groupByTurn(log).reverse();
  return (
    <section className="card" aria-label={text.log.title}>
      <h2>{text.log.title}</h2>
      {log.length === 0 ? (
        <span className="muted">{text.log.empty}</span>
      ) : (
        <ol className="bang-log">
          {turns.map(({ turn, entries }) => (
            <li key={turn?.id ?? 'before'}>
              {turn && <span className="bang-log-turn">{text.log.describe(turn, nameOf)}</span>}
              {entries.length > 0 && (
                <ol>
                  {[...entries].reverse().map((entry) => (
                    <li key={entry.id} className={entry.type === 'DEATH' ? 'death' : undefined}>
                      <Icon name={logIcon(entry)} />
                      <span>{text.log.describe(entry, nameOf)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}
      {/* The icons' licence asks for this credit wherever they are shown: see art/CREDITS.md. */}
      <p className="muted bang-credit">
        {text.credit} ·{' '}
        <a href="https://game-icons.net" target="_blank" rel="noreferrer">
          game-icons.net
        </a>{' '}
        (CC BY 3.0)
      </p>
    </section>
  );
}
