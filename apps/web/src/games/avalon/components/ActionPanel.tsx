import type { AvalonAction, AvalonView } from '@bgp/game-avalon';
import { useAvalonText } from '../useAvalonText';
import { Icon } from './Icon';

/**
 * What the viewer is asked right now, or what the table is waiting for. Which buttons there
 * are is the engine's call, via `legal`; the players picked for a team or as a target come
 * from the seats of the table. It stays in place while an answer is on its way: only its
 * buttons wait.
 */
export function ActionPanel({
  view,
  selected,
  nameOf,
  status,
  disabled,
  sendAction,
}: {
  view: AvalonView;
  /** The seats the viewer has picked. */
  selected: readonly string[];
  nameOf(playerId: string): string;
  /** What to say when nothing is asked of the viewer. */
  status: string;
  disabled: boolean;
  sendAction(action: AvalonAction): void;
}) {
  const text = useAvalonText();
  const { legal } = view;
  const target = selected[0];
  const names = (playerIds: readonly string[]) => playerIds.map(nameOf).join(', ');

  if (legal.propose) {
    const { teamSize } = legal.propose;
    return (
      <section className="card avalon-prompt yours">
        <h2>{text.prompt.proposeTitle(teamSize)}</h2>
        <p className="muted hint">{text.prompt.proposeHint}</p>
        <div className="avalon-prompt-row">
          <button
            type="button"
            disabled={disabled || selected.length !== teamSize}
            onClick={() => sendAction({ type: 'PROPOSE_TEAM', team: [...selected] })}
          >
            <Icon name="team" />
            {text.prompt.propose(selected.length, teamSize)}
          </button>
          {selected.length > 0 && <span className="avalon-picked">{names(selected)}</span>}
        </div>
      </section>
    );
  }

  if (legal.vote) {
    const { proposal } = legal.vote;
    const vote = (approve: boolean) => sendAction({ type: 'VOTE', proposal, approve });
    return (
      <section className="card avalon-prompt yours">
        <h2>{text.prompt.voteTitle}</h2>
        <p className="avalon-picked">
          <Icon name="team" /> {names(view.team ?? [])}
        </p>
        <div className="avalon-prompt-row">
          <button
            type="button"
            className="avalon-choice yes"
            disabled={disabled}
            onClick={() => vote(true)}
          >
            <Icon name="approve" />
            {text.prompt.approve}
          </button>
          <button
            type="button"
            className="avalon-choice no"
            disabled={disabled}
            onClick={() => vote(false)}
          >
            <Icon name="reject" />
            {text.prompt.reject}
          </button>
          <span className="muted hint">{text.prompt.voteHint}</span>
        </div>
      </section>
    );
  }

  if (legal.quest) {
    const { quest, canFail } = legal.quest;
    const play = (success: boolean) => sendAction({ type: 'PLAY_QUEST_CARD', quest, success });
    return (
      <section className="card avalon-prompt yours">
        <h2>{text.prompt.questTitle}</h2>
        <div className="avalon-prompt-row">
          <button
            type="button"
            className="avalon-choice yes"
            disabled={disabled}
            onClick={() => play(true)}
          >
            <Icon name="success" />
            {text.prompt.success}
          </button>
          <button
            type="button"
            className="avalon-choice no"
            disabled={disabled || !canFail}
            onClick={() => play(false)}
          >
            <Icon name="fail" />
            {text.prompt.fail}
          </button>
          <span className="muted hint">
            {canFail ? text.prompt.questHintEvil : text.prompt.questHintGood}
          </span>
        </div>
      </section>
    );
  }

  if (legal.ladyTargets.length > 0 || legal.assassinTargets.length > 0) {
    const lady = legal.ladyTargets.length > 0;
    return (
      <section className="card avalon-prompt yours">
        <h2>{lady ? text.prompt.ladyTitle : text.prompt.assassinTitle}</h2>
        <p className="muted hint">{lady ? text.prompt.ladyHint : text.prompt.assassinHint}</p>
        <div className="avalon-prompt-row">
          <button
            type="button"
            className={lady ? undefined : 'avalon-choice no'}
            disabled={disabled || target === undefined}
            onClick={() =>
              target &&
              sendAction(
                lady
                  ? { type: 'USE_LADY', targetId: target }
                  : { type: 'ASSASSINATE', targetId: target },
              )
            }
          >
            <Icon name={lady ? 'lady' : 'dagger'} />
            {target === undefined
              ? text.prompt.pickPlayer
              : lady
                ? text.prompt.look(nameOf(target))
                : text.prompt.assassinate(nameOf(target))}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card avalon-prompt">
      <p className="avalon-say" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
