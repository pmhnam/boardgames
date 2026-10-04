import type { AvalonView } from '@bgp/game-avalon';

/** The five quests, and how close the table is to running out of proposals. */
export function QuestTrack({ view }: { view: AvalonView }) {
  const underway = view.phase !== 'FINISHED' && view.phase !== 'ASSASSINATION';
  return (
    <section className="card avalon-track">
      <ol className="avalon-quests">
        {view.quests.map((quest, index) => {
          const state = quest.result ? (quest.result.success ? 'success' : 'failed') : 'open';
          const current = underway && index === view.questIndex;
          return (
            <li
              key={index}
              className={`avalon-quest ${state}${current ? ' current' : ''}`}
              aria-current={current ? 'step' : undefined}
            >
              <span className="avalon-quest-number">Quest {index + 1}</span>
              <span className="avalon-quest-size">{quest.teamSize}</span>
              <span className="avalon-quest-note">
                {quest.result
                  ? `${quest.result.success ? 'Success' : 'Failed'} · ${quest.result.fails} fail${quest.result.fails === 1 ? '' : 's'}`
                  : quest.failsRequired > 1
                    ? `players · ${quest.failsRequired} fails needed`
                    : 'players'}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="avalon-rejections">
        <span className="muted">Teams rejected in a row</span>
        <span className="avalon-pips" aria-hidden="true">
          {Array.from({ length: view.maxRejections }, (_, index) => (
            <span key={index} className={index < view.rejections ? 'pip used' : 'pip'} />
          ))}
        </span>
        <span className="num">
          {view.rejections} of {view.maxRejections}
        </span>
      </p>
    </section>
  );
}
