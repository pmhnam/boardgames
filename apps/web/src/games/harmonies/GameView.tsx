import {
  hexKey,
  type HarmoniesAction,
  type HarmoniesView,
  type Hex,
  type ScoreBreakdown,
  type TokenColor,
} from '@bgp/game-harmonies';
import { useEffect, useState } from 'react';
import type { Locale } from '../../shared/i18n/locales';
import { useLocale } from '../../shared/i18n/useT';
import { useTurnAlerts } from '../shared/useTurnAlerts';
import type { TurnAlertOptions } from '../shared/turnAlerts';
import { playerName, type GameViewProps } from '../types';
import { AnimalCardView } from './components/AnimalCardView';
import { CompletedCards } from './components/CompletedCards';
import { HexBoard } from './components/HexBoard';
import { Icon } from './components/Icon';
import { PlayerPanel } from './components/PlayerPanel';
import { ScoringGuide } from './components/ScoringGuide';
import { TokenChip } from './components/TokenChip';
import { HARMONIES_TEXT } from './text';
import './harmonies.css';

/** One object per language, so switching language is the only thing that restarts the alerts. */
const TURN_ALERTS: Record<Locale, TurnAlertOptions> = {
  vi: { preferenceKey: 'harmonies', ...HARMONIES_TEXT.vi.alerts },
  en: { preferenceKey: 'harmonies', ...HARMONIES_TEXT.en.alerts },
};

/** What the player has picked up and is about to put on their board. UI state only. */
type Selection =
  { kind: 'token'; color: TokenColor; index: number } | { kind: 'card'; cardId: string } | null;

/** What each column of the score is drawn with. */
const SCORE_COLUMNS: Array<[keyof ScoreBreakdown, TokenColor | 'paw' | null]> = [
  ['trees', 'leaf'],
  ['mountains', 'mountain'],
  ['fields', 'field'],
  ['buildings', 'building'],
  ['water', 'water'],
  ['animals', 'paw'],
  ['total', null],
];

function ScoreMark({ mark }: { mark: TokenColor | 'paw' }) {
  return mark === 'paw' ? (
    <Icon name="paw" className="harmonies-score-paw" />
  ) : (
    <TokenChip color={mark} />
  );
}

export function HarmoniesGameView({
  message,
  players,
  sendAction,
  disabled,
  autoplay,
}: GameViewProps<HarmoniesView, HarmoniesAction>) {
  const locale = useLocale();
  const text = HARMONIES_TEXT[locale];
  const view = message.state;
  const me = message.viewerPlayerId;
  const { legal, turn } = view;
  const playing = view.phase === 'PLAYING';
  const alerts = useTurnAlerts(
    {
      gameId: message.gameId,
      playerId: me,
      number: turn.number,
      mine:
        playing &&
        message.status === 'playing' &&
        me !== null &&
        turn.activePlayerId === me &&
        !autoplay?.enabled,
    },
    TURN_ALERTS[locale],
  );
  const isMyTurn =
    !disabled && !autoplay?.enabled && !autoplay?.pending && playing && turn.activePlayerId === me;
  const myBoard = me === null ? undefined : view.boards[me];
  // It goes by whose turn it is rather than `isMyTurn`, so nothing flickers while an action
  // is in flight.
  const mine = playing && turn.activePlayerId === me;
  const placeable = (color: TokenColor) => (legal.tokenCells[color]?.length ?? 0) > 0;

  // A choice only makes sense for the state it was made in. Until the player makes one, the
  // first token that can go somewhere is already in hand: placing three takes three clicks.
  const [choice, setChoice] = useState<{ version: number; selection: Selection } | null>(null);
  const firstPlaceable = turn.hand.findIndex(placeable);
  const firstColor = turn.hand[firstPlaceable];
  const selection: Selection =
    choice?.version === message.version
      ? choice.selection
      : mine && !autoplay?.enabled && firstColor !== undefined
        ? { kind: 'token', color: firstColor, index: firstPlaceable }
        : null;
  const select = (next: Selection) => setChoice({ version: message.version, selection: next });

  // Escape puts back whatever is in hand.
  const holding = selection !== null;
  useEffect(() => {
    if (!holding) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setChoice({ version: message.version, selection: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [holding, message.version]);

  const targetCells: Hex[] =
    selection?.kind === 'token'
      ? (legal.tokenCells[selection.color] ?? [])
      : selection?.kind === 'card'
        ? (legal.cubeCells[selection.cardId] ?? [])
        : [];
  const targets = new Set(targetCells.map(hexKey));

  const placeAt = (cell: Hex) => {
    if (selection?.kind === 'token') {
      sendAction({ type: 'PLACE_TOKEN', color: selection.color, cell });
    } else if (selection?.kind === 'card') {
      sendAction({ type: 'PLACE_CUBE', cardId: selection.cardId, cell });
    }
  };

  // What to do next, read off what the engine says is possible right now.
  const activeName = playerName(players, turn.activePlayerId);
  const hasPlaceable = firstPlaceable >= 0;
  const status = !playing
    ? text.status.over
    : autoplay?.enabled && mine
      ? text.status.bot
      : !mine
        ? turn.hand.length > 0
          ? text.status.holding(activeName)
          : text.status.waiting(activeName)
        : selection?.kind === 'card'
          ? text.status.pickAnimalCell
          : selection
            ? text.status.pickCell
            : legal.canTakeTokens
              ? text.status.take
              : hasPlaceable
                ? text.status.place
                : text.status.extras;
  // Where the turn has got to: tokens are taken, then placed, and the rest is up to the player.
  const step = !turn.tokensTaken ? 0 : turn.hand.length > 0 ? 1 : 2;

  const inProgress = myBoard?.cards.filter((entry) => !entry.complete) ?? [];

  // Everyone but the viewer, in play order. A spectator sees every board this way.
  const others = view.turnOrder.filter((playerId) => playerId !== me || !myBoard);

  // The score table keeps play order while the game runs, so rows do not swap under the
  // reader, and lists the winners first once it is over.
  const ranking = playing
    ? view.turnOrder
    : [...view.turnOrder].sort(
        (a, b) =>
          Number(view.winnerPlayerIds.includes(b)) - Number(view.winnerPlayerIds.includes(a)) ||
          (view.scores[b]?.total ?? 0) - (view.scores[a]?.total ?? 0),
      );

  // One bar for the turn, always there and always the same size: what to do or who is
  // playing, the tokens in hand, and the end of the turn. Nothing around it moves as the
  // turn passes from player to player.
  const statusBar = (
    <div className="harmonies-status">
      {playing && (
        <ol className="harmonies-steps" aria-label={text.stepsLabel}>
          {text.steps.map((label, index) => (
            <li
              key={label}
              className={index < step ? 'done' : index === step ? 'current' : undefined}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="harmonies-step-mark" aria-hidden="true">
                {index < step ? <Icon name="check" /> : index + 1}
              </span>
              <span className="harmonies-step-label">{label}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="harmonies-status-row">
        <p className="harmonies-step" aria-live="polite">
          {status}
        </p>
        <div className="harmonies-hand">
          {turn.hand.map((color, index) => {
            const selected = selection?.kind === 'token' && selection.index === index;
            return mine ? (
              <button
                key={index}
                type="button"
                className={selected ? 'token-button selected' : 'token-button'}
                disabled={!isMyTurn || !placeable(color)}
                aria-pressed={selected}
                onClick={() => select(selected ? null : { kind: 'token', color, index })}
              >
                <TokenChip color={color} />
                <span className="token-label" aria-hidden="true">
                  {text.token[color]}
                </span>
              </button>
            ) : (
              <TokenChip key={index} color={color} />
            );
          })}
        </div>
        {myBoard && playing && (
          <button
            type="button"
            className={legal.canEndTurn && step === 2 ? 'harmonies-end ready' : 'harmonies-end'}
            disabled={!isMyTurn || !legal.canEndTurn}
            onClick={() => sendAction({ type: 'END_TURN' })}
          >
            {text.endTurn}
          </button>
        )}
      </div>
    </div>
  );

  const notifying = alerts.notifications && alerts.permission === 'granted';
  const scores = (
    <section className="card harmonies-scores">
      <h2>{text.scores}</h2>
      <div className="harmonies-scores-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">{text.player}</th>
              {SCORE_COLUMNS.map(([key, mark]) => (
                <th key={key} scope="col" className="num">
                  <span className="harmonies-score-head" title={text.score[key]}>
                    {mark && <ScoreMark mark={mark} />}
                    <span className={mark ? 'harmonies-score-label' : undefined}>
                      {text.score[key]}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranking.map((playerId) => (
              <tr
                key={playerId}
                className={
                  [playerId === me && 'mine', view.winnerPlayerIds.includes(playerId) && 'winner']
                    .filter(Boolean)
                    .join(' ') || undefined
                }
              >
                <th scope="row">
                  {playerName(players, playerId)}
                  {playerId === me && <span className="muted"> ({text.you})</span>}
                  {view.winnerPlayerIds.includes(playerId) && (
                    <Icon name="trophy" className="harmonies-trophy" />
                  )}
                </th>
                {SCORE_COLUMNS.map(([key]) => (
                  <td key={key} className={key === 'total' ? 'num total' : 'num'}>
                    {view.scores[playerId]?.[key] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="harmonies">
      <header className={mine ? 'harmonies-banner mine' : 'harmonies-banner'}>
        <div className="harmonies-banner-text">
          <p className="harmonies-turn">
            {view.phase === 'FINISHED'
              ? text.gameOver
              : mine
                ? text.yourTurn
                : text.turnOf(activeName)}
            {view.finalRound && playing && (
              <span className="harmonies-final">{text.finalRound}</span>
            )}
          </p>
          <p className="harmonies-meta muted">
            <span>{view.map.name}</span>
            <span>{text.turnNumber(turn.number)}</span>
            <span title={text.pouch(view.pouchCount)}>
              <Icon name="pouch" /> {view.pouchCount}
              <span className="sr-only"> {text.pouch(view.pouchCount)}</span>
            </span>
            <span title={text.deck(view.cardDeckCount)}>
              <Icon name="deck" /> {view.cardDeckCount}
              <span className="sr-only"> {text.deck(view.cardDeckCount)}</span>
            </span>
          </p>
        </div>

        {me !== null && playing && (
          <div className="harmonies-tools" role="group" aria-label={text.controls}>
            {autoplay && (
              <button
                type="button"
                className="harmonies-tool"
                aria-pressed={autoplay.enabled}
                disabled={autoplay.pending || (!autoplay.enabled && disabled)}
                onClick={autoplay.toggle}
              >
                <Icon name="robot" />
                <span>
                  {autoplay.pending ? text.botPending : autoplay.enabled ? text.botOff : text.botOn}
                </span>
              </button>
            )}
            <button
              type="button"
              className="harmonies-tool"
              aria-pressed={alerts.sound}
              onClick={alerts.toggleSound}
            >
              <Icon name={alerts.sound ? 'speaker' : 'speakerOff'} />
              <span>{alerts.sound ? text.soundOn : text.soundOff}</span>
            </button>
            <button
              type="button"
              className="harmonies-tool"
              aria-pressed={notifying}
              disabled={!alerts.supported || alerts.permission === 'denied' || alerts.requesting}
              title={text.notifyHint}
              onClick={() => void alerts.toggleNotifications()}
            >
              <Icon name="bell" />
              <span>
                {alerts.requesting
                  ? text.notifyRequesting
                  : notifying
                    ? text.notifyOff
                    : text.notifyOn}
              </span>
            </button>
          </div>
        )}
      </header>

      {me !== null && playing && (
        <>
          {autoplay?.enabled && (
            <p className="muted hint" role="status">
              {text.botNote}
            </p>
          )}
          {autoplay?.error && (
            <p className="error" role="alert">
              {autoplay.error}
            </p>
          )}
          {!alerts.supported && <p className="muted hint">{text.notifyUnsupported}</p>}
          {alerts.supported && alerts.permission === 'denied' && (
            <p className="muted hint">{text.notifyDenied}</p>
          )}
          {alerts.error && (
            <p className="muted hint" role="status">
              {alerts.error}
            </p>
          )}
        </>
      )}

      {!playing && scores}

      {/* Laid out so a turn needs no scrolling: the cards on offer down the left, the tokens
          above the viewer's own board in the middle, everyone else on the right. */}
      <div className={myBoard ? 'harmonies-table' : 'harmonies-table watching'}>
        <section className="card harmonies-supply">
          <h2>
            {text.central} <span className="muted">· {text.centralHint}</span>
          </h2>
          <div className="harmonies-spaces">
            {view.centralSpaces.map((space, index) => (
              <button
                key={index}
                type="button"
                className={space.length === 0 ? 'central-space empty' : 'central-space'}
                disabled={!isMyTurn || !legal.canTakeTokens || space.length === 0}
                aria-label={
                  space.length === 0
                    ? text.emptySpace
                    : text.takeSpace(space.map((color) => text.token[color]))
                }
                onClick={() => sendAction({ type: 'TAKE_TOKENS', spaceIndex: index })}
              >
                {space.map((color, tokenIndex) => (
                  <TokenChip key={tokenIndex} color={color} />
                ))}
              </button>
            ))}
          </div>
          {!myBoard && statusBar}
        </section>

        <section className="card harmonies-river">
          <h2>
            {text.river}{' '}
            <span className="muted" title={text.deck(view.cardDeckCount)}>
              <Icon name="deck" /> {view.cardDeckCount}
            </span>
          </h2>
          <div className="harmonies-card-list">
            {view.cardRiver.map((card) => (
              <AnimalCardView
                key={card.id}
                card={card}
                landscape
                action={
                  myBoard && playing ? (
                    <button
                      type="button"
                      disabled={!isMyTurn || !legal.canTakeCard}
                      onClick={() => sendAction({ type: 'TAKE_CARD', cardId: card.id })}
                    >
                      {text.takeCard}
                    </button>
                  ) : undefined
                }
              />
            ))}
          </div>
          {/* Under the cards, so they do not move when it appears. */}
          {mine && !autoplay?.enabled && !legal.canTakeCard && (
            <p className="muted hint">{turn.cardTaken ? text.cardTaken : text.noRoomForCard}</p>
          )}
          <details className="harmonies-card-help">
            <summary>{text.howToRead}</summary>
            <p className="muted hint">{text.howToReadBody}</p>
          </details>
        </section>

        {myBoard && me !== null && (
          <section className={mine ? 'card harmonies-mine active' : 'card harmonies-mine'}>
            <h2 className="harmonies-player-name">
              <span>
                {text.yourBoard}
                {view.winnerPlayerIds.includes(me) && (
                  <Icon name="trophy" className="harmonies-trophy" />
                )}
              </span>
              <span className="harmonies-score">
                {view.scores[me]?.total ?? 0} <span className="muted">{text.points}</span>
              </span>
            </h2>
            {statusBar}
            <div className="harmonies-mine-body">
              <div className="harmonies-mine-board">
                <HexBoard
                  cells={view.boardCells}
                  board={myBoard}
                  turnNumber={turn.number}
                  label={text.yourBoard}
                  targets={isMyTurn ? targets : undefined}
                  preview={
                    selection?.kind === 'token'
                      ? selection.color
                      : selection?.kind === 'card'
                        ? 'animal'
                        : undefined
                  }
                  onSelect={placeAt}
                />
                <ul className="harmonies-breakdown" aria-label={text.scores}>
                  {SCORE_COLUMNS.map(
                    ([key, mark]) =>
                      mark && (
                        <li key={key} title={text.score[key]}>
                          <ScoreMark mark={mark} />
                          <span className="sr-only">{text.score[key]}</span>
                          {view.scores[me]?.[key] ?? 0}
                        </li>
                      ),
                  )}
                </ul>
              </div>
              <div className="harmonies-mine-side">
                {myBoard.cards.length === 0 && <p className="muted hint">{text.noCards}</p>}
                {inProgress.length > 0 && (
                  <div className="harmonies-card-list">
                    {inProgress.map(({ card, cubesPlaced }) => {
                      const selected = selection?.kind === 'card' && selection.cardId === card.id;
                      const canPlace = isMyTurn && (legal.cubeCells[card.id]?.length ?? 0) > 0;
                      return (
                        <AnimalCardView
                          key={card.id}
                          card={card}
                          cubesPlaced={cubesPlaced}
                          selected={selected}
                          landscape
                          action={
                            playing ? (
                              <button
                                type="button"
                                disabled={!canPlace}
                                aria-pressed={selected}
                                onClick={() =>
                                  select(selected ? null : { kind: 'card', cardId: card.id })
                                }
                              >
                                {selected ? text.cancel : text.placeAnimal}
                              </button>
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </div>
                )}
                <CompletedCards cards={myBoard.cards.filter((entry) => entry.complete)} />
              </div>
            </div>
          </section>
        )}

        <div className="harmonies-side">
          {others.map((playerId) => {
            const board = view.boards[playerId];
            if (!board) return null;
            return (
              <PlayerPanel
                key={playerId}
                name={playerName(players, playerId)}
                cells={view.boardCells}
                board={board}
                turnNumber={turn.number}
                points={view.scores[playerId]?.total ?? 0}
                active={playing && turn.activePlayerId === playerId}
                winner={view.winnerPlayerIds.includes(playerId)}
              />
            );
          })}
        </div>
      </div>

      {playing && scores}

      <ScoringGuide view={view} />
    </div>
  );
}
