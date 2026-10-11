import {
  alignmentOf,
  type AvalonAction,
  type AvalonPhase,
  type AvalonView,
  type Role,
} from '@bgp/game-avalon';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Locale } from '../../shared/i18n/locales';
import { useLocale } from '../../shared/i18n/useT';
import { seatSpots } from '../shared/seats';
import type { TurnAlertOptions } from '../shared/turnAlerts';
import { useSharedView } from '../shared/useSharedView';
import { useTurnAlerts } from '../shared/useTurnAlerts';
import { playerName, type GameViewProps } from '../types';
import type { IconName } from './art/icons';
import { ActionPanel } from './components/ActionPanel';
import { Icon } from './components/Icon';
import { ProposalHistory } from './components/ProposalHistory';
import { QuestTrack } from './components/QuestTrack';
import { RoleCard } from './components/RoleCard';
import { Table } from './components/Table';
import { AVALON_TEXT, type AvalonText } from './text';
import { awaitsAvalonViewer } from './turn';
import './avalon.css';

/** One object per language, so switching language is the only thing that restarts the alerts. */
const TURN_ALERTS: Record<Locale, TurnAlertOptions> = {
  vi: { preferenceKey: 'avalon', ...AVALON_TEXT.vi.alerts },
  en: { preferenceKey: 'avalon', ...AVALON_TEXT.en.alerts },
};

const PHASES: AvalonPhase[] = [
  'TEAM_PROPOSAL',
  'TEAM_VOTE',
  'QUEST',
  'LADY',
  'ASSASSINATION',
  'FINISHED',
];

const PHASE_ICON: Record<AvalonPhase, IconName> = {
  TEAM_PROPOSAL: 'leader',
  TEAM_VOTE: 'vote',
  QUEST: 'quest',
  LADY: 'lady',
  ASSASSINATION: 'dagger',
  FINISHED: 'trophy',
};

/** Up to ten sit at this table, so its ring reaches a little further out than most. */
const REACH = { x: 41, y: 38 };
const NOBODY: readonly string[] = [];

/** How many seats the viewer has to pick, and from which. Nothing to pick: no seats. */
function getPicking(view: AvalonView): { from: readonly string[]; count: number } {
  const { legal } = view;
  if (legal.propose) return { from: view.seatOrder, count: legal.propose.teamSize };
  if (legal.ladyTargets.length > 0) return { from: legal.ladyTargets, count: 1 };
  if (legal.assassinTargets.length > 0) return { from: legal.assassinTargets, count: 1 };
  return { from: NOBODY, count: 0 };
}

/** One line saying where the game is, from the viewer's side of it. */
function describeStatus(
  view: AvalonView,
  nameOf: (playerId: string) => string,
  text: AvalonText,
): string {
  const { you, legal } = view;
  const leader = view.leaderId === null ? '' : nameOf(view.leaderId);
  const teamSize = view.quests[view.questIndex]?.teamSize ?? 0;
  switch (view.phase) {
    case 'TEAM_PROPOSAL':
      return legal.propose ? text.status.youLead(teamSize) : text.status.leading(leader, teamSize);
    case 'TEAM_VOTE': {
      if (legal.vote) return text.status.voteNow(leader);
      const waiting = text.status.waitingVotes(view.seatOrder.length - view.voted.length);
      return you && you.vote !== null ? `${text.status.youVoted(you.vote)} ${waiting}` : waiting;
    }
    case 'QUEST': {
      if (legal.quest) return text.status.questNow;
      const waiting = text.status.waitingCards((view.team?.length ?? 0) - view.played.length);
      return you && you.questCard !== null ? `${text.status.youPlayed} ${waiting}` : waiting;
    }
    case 'LADY':
      return legal.ladyTargets.length > 0
        ? text.status.ladyYours
        : text.status.ladyOf(view.lady ? nameOf(view.lady.holderId) : '');
    case 'ASSASSINATION':
      return legal.assassinTargets.length > 0
        ? text.status.assassinYours
        : text.status.assassinOf(view.assassinId ? nameOf(view.assassinId) : '');
    case 'FINISHED':
      return view.outcome ? text.outcome[view.outcome.reason] : text.phase.FINISHED;
  }
}

/** How far along a step is that several people take at once: votes cast, or cards played. */
function Tally({ done, of }: { done: number; of: number }) {
  return (
    <span className="avalon-tally" aria-hidden="true">
      {Array.from({ length: of }, (_, index) => (
        <span key={index} className={index < done ? 'pip used' : 'pip'} />
      ))}
    </span>
  );
}

export function AvalonGameView({
  message,
  players,
  sendAction,
  disabled,
}: GameViewProps<AvalonView, AvalonAction>) {
  const locale = useLocale();
  const text = AVALON_TEXT[locale];
  const view = useSharedView(message.state);
  const me = message.viewerPlayerId;
  const { you } = view;
  const over = view.phase === 'FINISHED';
  const nameOf = useCallback((playerId: string) => playerName(players, playerId), [players]);

  // A chime for each new thing asked of the viewer: a team to choose, a vote, a card. Each
  // has a number of its own, so two asks in a row both sound.
  const alerts = useTurnAlerts(
    {
      gameId: message.gameId,
      playerId: me,
      number: view.proposals.length * 16 + view.questIndex * 4 + PHASES.indexOf(view.phase),
      mine: message.status === 'playing' && !over && me !== null && awaitsAvalonViewer(view),
    },
    TURN_ALERTS[locale],
  );
  const notifying = alerts.notifications && alerts.permission === 'granted';

  // What was picked only makes sense for the state it was picked in.
  const [picked, setPicked] = useState<{ version: number; ids: readonly string[] }>({
    version: message.version,
    ids: NOBODY,
  });
  const selected = picked.version === message.version ? picked.ids : NOBODY;
  const picking = getPicking(view);
  const toggle = (playerId: string) => {
    if (!picking.from.includes(playerId)) return;
    const next = selected.includes(playerId)
      ? selected.filter((id) => id !== playerId)
      : picking.count === 1
        ? [playerId]
        : selected.length < picking.count
          ? // Seat order, so a team reads the same whatever order it was picked in.
            view.seatOrder.filter((id) => id === playerId || selected.includes(id))
          : selected;
    setPicked({ version: message.version, ids: next });
  };
  // The seats are handed the same function for as long as the table lives, so a handler made
  // anew by every render is no reason to draw them again.
  const latestToggle = useRef(toggle);
  latestToggle.current = toggle;
  const [onToggle] = useState(() => (playerId: string) => latestToggle.current(playerId));

  const viewerIndex = me === null ? -1 : view.seatOrder.indexOf(me);
  const seatCount = view.seatOrder.length;
  const spots = useMemo(() => seatSpots(seatCount, viewerIndex, REACH), [seatCount, viewerIndex]);

  const status = describeStatus(view, nameOf, text);
  const questNumber = Math.min(view.questIndex + 1, view.quests.length);
  const cast = useMemo(() => {
    const roles = [...new Set(view.rolesInPlay)];
    return roles.map((role: Role) => ({
      role,
      count: view.rolesInPlay.filter((dealt) => dealt === role).length,
    }));
  }, [view.rolesInPlay]);
  const goodWon = view.outcome?.winner === 'GOOD';

  return (
    <div className="avalon">
      <header className={over ? 'card avalon-banner over' : 'card avalon-banner'}>
        <div className="avalon-banner-title">
          <Icon name={over ? 'trophy' : 'table'} />
          <div>
            <strong>{text.phase[view.phase]}</strong>
            <span className="muted">{text.questOf(questNumber, view.quests.length)}</span>
          </div>
        </div>
        <QuestTrack
          quests={view.quests}
          questIndex={view.questIndex}
          underway={!over && view.phase !== 'ASSASSINATION'}
          rejections={view.rejections}
          maxRejections={view.maxRejections}
        />
        {me !== null && !over && (
          <div className="avalon-tools" role="group" aria-label={text.tools.label}>
            <button
              type="button"
              className="avalon-tool"
              aria-pressed={alerts.sound}
              onClick={alerts.toggleSound}
            >
              <Icon name={alerts.sound ? 'speaker' : 'speakerOff'} />
              <span>{alerts.sound ? text.tools.soundOn : text.tools.soundOff}</span>
            </button>
            <button
              type="button"
              className="avalon-tool"
              aria-pressed={notifying}
              disabled={!alerts.supported || alerts.permission === 'denied' || alerts.requesting}
              title={
                !alerts.supported
                  ? text.tools.notifyUnsupported
                  : alerts.permission === 'denied'
                    ? text.tools.notifyDenied
                    : text.tools.notifyHint
              }
              onClick={() => void alerts.toggleNotifications()}
            >
              <Icon name="bell" />
              <span>
                {alerts.requesting
                  ? text.tools.notifyRequesting
                  : notifying
                    ? text.tools.notifyOff
                    : text.tools.notifyOn}
              </span>
            </button>
          </div>
        )}
        {alerts.error && (
          <p className="muted hint" role="status">
            {alerts.error}
          </p>
        )}
      </header>

      <div className="avalon-layout">
        <div className="avalon-main">
          <div className="avalon-play">
            <Table
              view={view}
              me={me}
              nameOf={nameOf}
              spots={spots}
              selectable={picking.from}
              selected={selected}
              onToggle={onToggle}
            >
              <span
                className={over ? `avalon-emblem ${goodWon ? 'good' : 'evil'}` : 'avalon-emblem'}
              >
                <Icon name={over ? (goodWon ? 'good' : 'evil') : PHASE_ICON[view.phase]} />
              </span>
              <strong className="avalon-centre-title">
                {over && view.outcome
                  ? text.alignment[view.outcome.winner]
                  : text.phase[view.phase]}
              </strong>
              {view.phase === 'TEAM_VOTE' && (
                <Tally done={view.voted.length} of={view.seatOrder.length} />
              )}
              {view.phase === 'QUEST' && (
                <Tally done={view.played.length} of={view.team?.length ?? 0} />
              )}
              {over && view.assassinId && view.assassinTargetId && (
                <span className="avalon-centre-note">
                  {text.named(nameOf(view.assassinId), nameOf(view.assassinTargetId))}
                </span>
              )}
            </Table>

            <div className="avalon-dock">
              <ActionPanel
                view={view}
                selected={selected}
                nameOf={nameOf}
                status={me === null && !over ? `${text.watching} ${status}` : status}
                disabled={disabled}
                sendAction={sendAction}
              />
            </div>
          </div>

          <ProposalHistory proposals={view.proposals} seatOrder={view.seatOrder} nameOf={nameOf} />
        </div>

        <aside className="avalon-side">
          {you && me !== null && <RoleCard lady={view.lady} you={you} me={me} nameOf={nameOf} />}
          <section className="card" aria-label={text.cast.title}>
            <h2>{text.cast.title}</h2>
            <ul className="avalon-cast">
              {cast.map(({ role, count }) => (
                <li key={role}>
                  <span className={`avalon-crest small ${alignmentOf(role).toLowerCase()}`}>
                    <Icon name={role} />
                  </span>
                  <span>{text.role[role]}</span>
                  <span className="num">×{count}</span>
                </li>
              ))}
            </ul>
            <p className="muted hint">{text.cast.goal(view.maxRejections)}</p>
            {/* The icons' licence asks for this credit wherever they are shown: see
                art/CREDITS.md. */}
            <p className="muted avalon-credit">
              {text.credit} ·{' '}
              <a href="https://game-icons.net" target="_blank" rel="noreferrer">
                game-icons.net
              </a>{' '}
              (CC BY 3.0)
            </p>
          </section>
          {view.lady && (
            <section className="card" aria-label={text.lady.title}>
              <h2>
                <Icon name="lady" /> {text.lady.title}
              </h2>
              <p>
                {over
                  ? text.lady.lastHeldBy(nameOf(view.lady.holderId))
                  : text.lady.heldBy(nameOf(view.lady.holderId))}
              </p>
              {view.lady.inspections.length > 0 && (
                <ul className="avalon-lady">
                  {view.lady.inspections.map((inspection) => (
                    <li key={inspection.targetId}>
                      {text.lady.looked(nameOf(inspection.holderId), nameOf(inspection.targetId))}
                      {inspection.alignment && (
                        <span className={`avalon-known ${inspection.alignment.toLowerCase()}`}>
                          {' '}
                          {text.alignment[inspection.alignment]}
                        </span>
                      )}
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
