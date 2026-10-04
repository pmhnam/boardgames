import type { AvalonAction, AvalonView } from '@bgp/game-avalon';

/**
 * What the viewer has to do right now, if anything. Which buttons there are is the engine's
 * call, via `legal`; the players picked for a team or as a target come from the seats above.
 */
export function ActionPanel({
  view,
  selected,
  describe,
  disabled,
  sendAction,
}: {
  view: AvalonView;
  /** The seats the viewer has picked. */
  selected: string[];
  /** Names for a list of players. */
  describe(playerIds: string[]): string;
  disabled: boolean;
  sendAction(action: AvalonAction): void;
}) {
  const { legal } = view;
  const target = selected[0];

  if (legal.propose) {
    const { teamSize } = legal.propose;
    return (
      <section className="card avalon-prompt">
        <h2>Choose a team of {teamSize}</h2>
        <p className="muted">
          Pick players from the table below. You may pick yourself. Everyone then votes on it.
        </p>
        <div className="row wrap">
          <button
            type="button"
            disabled={disabled || selected.length !== teamSize}
            onClick={() => sendAction({ type: 'PROPOSE_TEAM', team: selected })}
          >
            Propose team ({selected.length}/{teamSize})
          </button>
          {selected.length > 0 && <span>{describe(selected)}</span>}
        </div>
      </section>
    );
  }

  if (legal.vote) {
    const { proposal } = legal.vote;
    const vote = (approve: boolean) => sendAction({ type: 'VOTE', proposal, approve });
    return (
      <section className="card avalon-prompt">
        <h2>Send this team on the quest?</h2>
        <p>{describe(view.team ?? [])}</p>
        <div className="row wrap">
          <button type="button" disabled={disabled} onClick={() => vote(true)}>
            Approve
          </button>
          <button
            type="button"
            className="secondary"
            disabled={disabled}
            onClick={() => vote(false)}
          >
            Reject
          </button>
          <span className="muted">Votes are shown once everyone has voted.</span>
        </div>
      </section>
    );
  }

  if (legal.quest) {
    const { quest, canFail } = legal.quest;
    const play = (success: boolean) => sendAction({ type: 'PLAY_QUEST_CARD', quest, success });
    return (
      <section className="card avalon-prompt">
        <h2>You are on the quest: play a card</h2>
        <div className="row wrap">
          <button type="button" disabled={disabled} onClick={() => play(true)}>
            Success
          </button>
          <button
            type="button"
            className="secondary"
            disabled={disabled || !canFail}
            onClick={() => play(false)}
          >
            Fail
          </button>
          <span className="muted">
            {canFail
              ? 'Only the number of Fails is announced, never who played them.'
              : 'The good side always plays Success.'}
          </span>
        </div>
      </section>
    );
  }

  if (legal.ladyTargets.length > 0) {
    return (
      <section className="card avalon-prompt">
        <h2>Use the Lady of the Lake</h2>
        <p className="muted">
          Pick a player below to learn which side they are on. Only you see the answer, and the Lady
          passes to them.
        </p>
        <div className="row wrap">
          <button
            type="button"
            disabled={disabled || target === undefined}
            onClick={() => target && sendAction({ type: 'USE_LADY', targetId: target })}
          >
            {target ? `Look at ${describe([target])}` : 'Pick a player'}
          </button>
        </div>
      </section>
    );
  }

  if (legal.assassinTargets.length > 0) {
    return (
      <section className="card avalon-prompt">
        <h2>Name Merlin</h2>
        <p className="muted">
          Good has its three quests. Pick the player you believe is Merlin: if you are right, evil
          wins.
        </p>
        <div className="row wrap">
          <button
            type="button"
            disabled={disabled || target === undefined}
            onClick={() => target && sendAction({ type: 'ASSASSINATE', targetId: target })}
          >
            {target ? `Assassinate ${describe([target])}` : 'Pick a player'}
          </button>
        </div>
      </section>
    );
  }

  return null;
}
