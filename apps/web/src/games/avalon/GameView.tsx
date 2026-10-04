import type { AvalonAction, AvalonView } from '@bgp/game-avalon';
import { useEffect, useState } from 'react';
import { playerName, type GameViewProps } from '../types';
import { ActionPanel } from './components/ActionPanel';
import { PlayerSeats } from './components/PlayerSeats';
import { ProposalHistory } from './components/ProposalHistory';
import { QuestTrack } from './components/QuestTrack';
import { RoleCard } from './components/RoleCard';
import { OUTCOME_TEXT, describeRoles } from './layout';

/** How many seats the viewer has to pick, and from which. Nothing to pick: no seats. */
function getPicking(view: AvalonView): { from: string[]; count: number } {
  const { legal } = view;
  if (legal.propose) return { from: view.seatOrder, count: legal.propose.teamSize };
  if (legal.ladyTargets.length > 0) return { from: legal.ladyTargets, count: 1 };
  if (legal.assassinTargets.length > 0) return { from: legal.assassinTargets, count: 1 };
  return { from: [], count: 0 };
}

export function AvalonGameView({
  message,
  players,
  sendAction,
  disabled,
}: GameViewProps<AvalonView, AvalonAction>) {
  const view = message.state;
  const me = message.viewerPlayerId;
  const { you } = view;
  const name = (playerId: string) => playerName(players, playerId);
  const describe = (playerIds: string[]) => playerIds.map(name).join(', ');

  const [selected, setSelected] = useState<string[]>([]);
  // What was picked only makes sense for the state it was picked in.
  useEffect(() => setSelected([]), [message.version]);

  const picking = getPicking(view);
  const toggle = (playerId: string) =>
    setSelected((current) => {
      if (current.includes(playerId)) return current.filter((id) => id !== playerId);
      if (picking.count === 1) return [playerId];
      // Seat order, so a team reads the same whatever order it was picked in.
      return current.length < picking.count
        ? view.seatOrder.filter((id) => id === playerId || current.includes(id))
        : current;
    });

  const waitingOn = (count: number, what: string) =>
    `Waiting for ${count} more ${what}${count === 1 ? '' : 's'}`;
  const leader = view.leaderId === null ? '' : name(view.leaderId);
  const teamSize = view.quests[view.questIndex]?.teamSize ?? 0;

  /** One line saying where the game is, from the viewer's side of it. */
  const status = (): string => {
    switch (view.phase) {
      case 'TEAM_PROPOSAL':
        return view.legal.propose
          ? 'You lead: choose a team'
          : `${leader} is choosing a team of ${teamSize}`;
      case 'TEAM_VOTE':
        if (view.legal.vote) return `${leader} proposes a team: vote`;
        return you?.vote === null || you === null
          ? waitingOn(view.seatOrder.length - view.voted.length, 'vote')
          : `You ${you.vote ? 'approved' : 'rejected'}. ${waitingOn(view.seatOrder.length - view.voted.length, 'vote')}`;
      case 'QUEST':
        if (view.legal.quest) return 'The team is approved: play your quest card';
        return `The team is on the quest. ${waitingOn((view.team?.length ?? 0) - view.played.length, 'card')}`;
      case 'LADY':
        return view.legal.ladyTargets.length > 0
          ? 'You hold the Lady of the Lake'
          : `${view.lady ? name(view.lady.holderId) : 'Someone'} is using the Lady of the Lake`;
      case 'ASSASSINATION':
        return view.legal.assassinTargets.length > 0
          ? 'Good has three quests: name Merlin'
          : `${view.assassinId ? name(view.assassinId) : 'The Assassin'} is the Assassin, and is looking for Merlin`;
      case 'FINISHED':
        return view.outcome ? OUTCOME_TEXT[view.outcome.reason] : 'Game over';
    }
  };

  return (
    <div className="stack avalon">
      <header className="avalon-banner">
        <p className="avalon-status" aria-live="polite">
          {status()}
        </p>
        <p className="muted">
          {view.phase === 'FINISHED' && view.assassinId && view.assassinTargetId
            ? `${name(view.assassinId)} named ${name(view.assassinTargetId)} as Merlin.`
            : `Quest ${Math.min(view.questIndex + 1, view.quests.length)} of ${view.quests.length}`}
        </p>
      </header>

      <QuestTrack view={view} />

      <ActionPanel
        view={view}
        selected={selected}
        describe={describe}
        disabled={disabled}
        sendAction={sendAction}
      />

      <div className="avalon-table">
        <div className="stack avalon-main">
          <PlayerSeats
            view={view}
            players={players}
            me={me}
            selectable={disabled ? [] : picking.from}
            selected={selected}
            onToggle={toggle}
          />
          <ProposalHistory view={view} players={players} />
        </div>

        <aside className="avalon-side">
          {you && me !== null && <RoleCard view={view} you={you} me={me} players={players} />}
          <section className="card">
            <h2>Roles in this game</h2>
            <p>{describeRoles(view.rolesInPlay)}</p>
            <p className="muted">
              Good needs three successful quests, and Merlin to stay hidden. Evil needs three failed
              quests, {view.maxRejections} teams rejected in a row, or Merlin’s name.
            </p>
          </section>
          {view.lady && (
            <section className="card">
              <h2>Lady of the Lake</h2>
              <p>
                {view.phase === 'FINISHED' ? 'Last held by' : 'Held by'} {name(view.lady.holderId)}.
              </p>
              {view.lady.inspections.length > 0 && (
                <ul className="avalon-lady">
                  {view.lady.inspections.map((inspection) => (
                    <li key={inspection.targetId}>
                      {name(inspection.holderId)} looked at {name(inspection.targetId)}
                      {inspection.alignment &&
                        `: ${inspection.alignment === 'GOOD' ? 'good' : 'evil'}`}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
