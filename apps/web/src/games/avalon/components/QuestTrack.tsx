import type { AvalonView } from '@bgp/game-avalon';
import { memo } from 'react';
import { useAvalonText } from '../useAvalonText';
import { Icon } from './Icon';

/**
 * The five quests as medallions, each showing how many go on it and how it turned out, and how
 * close the table is to running out of proposals. It changes a few times in a game.
 */
export const QuestTrack = memo(function QuestTrack({
  quests,
  questIndex,
  underway,
  rejections,
  maxRejections,
}: {
  quests: AvalonView['quests'];
  questIndex: number;
  /** A quest is still to be decided: the one in progress is marked. */
  underway: boolean;
  rejections: number;
  maxRejections: number;
}) {
  const text = useAvalonText();
  return (
    <div className="avalon-track">
      <ol className="avalon-quests" aria-label={text.quest.trackLabel}>
        {quests.map((quest, index) => {
          const state = quest.result ? (quest.result.success ? 'success' : 'failed') : 'open';
          const current = underway && index === questIndex;
          const note = quest.result
            ? `${quest.result.success ? text.quest.success : text.quest.failed} · ${text.quest.fails(quest.result.fails)}`
            : quest.failsRequired > 1
              ? `${text.quest.players(quest.teamSize)} · ${text.quest.failsNeeded(quest.failsRequired)}`
              : text.quest.players(quest.teamSize);
          return (
            <li
              key={index}
              className={`avalon-quest ${state}${current ? ' current' : ''}`}
              aria-current={current ? 'step' : undefined}
              title={`${text.quest.label(index + 1)}: ${note}`}
            >
              <span className="avalon-quest-coin" aria-hidden="true">
                {quest.result ? (
                  <Icon name={quest.result.success ? 'success' : 'fail'} />
                ) : (
                  quest.teamSize
                )}
                {!quest.result && quest.failsRequired > 1 && (
                  <span className="avalon-quest-double">{quest.failsRequired}</span>
                )}
              </span>
              <span className="sr-only">
                {text.quest.label(index + 1)}: {note}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="avalon-rejections" title={text.quest.rejections}>
        <Icon name="reject" />
        <span className="avalon-pips" aria-hidden="true">
          {Array.from({ length: maxRejections }, (_, index) => (
            <span key={index} className={index < rejections ? 'pip used' : 'pip'} />
          ))}
        </span>
        <span className="sr-only">
          {text.quest.rejections}: {text.quest.rejectionsOf(rejections, maxRejections)}
        </span>
      </p>
    </div>
  );
});
