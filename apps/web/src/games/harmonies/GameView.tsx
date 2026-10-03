import {
  hexKey,
  type HarmoniesAction,
  type HarmoniesView,
  type Hex,
  type ScoreBreakdown,
  type TokenColor,
} from '@bgp/game-harmonies';
import { useEffect, useState } from 'react';
import { playerName, type GameViewProps } from '../types';
import { AnimalCardView } from './components/AnimalCardView';
import { CompletedCards } from './components/CompletedCards';
import { HexBoard } from './components/HexBoard';
import { PlayerPanel } from './components/PlayerPanel';
import { ScoringGuide } from './components/ScoringGuide';
import { TokenChip } from './components/TokenChip';
import { TOKEN_LABEL } from './layout';

/** What the player has picked up and is about to put on their board. UI state only. */
type Selection = { kind: 'token'; color: TokenColor } | { kind: 'card'; cardId: string } | null;

const SCORE_COLUMNS: Array<[keyof ScoreBreakdown, string]> = [
  ['trees', 'Trees'],
  ['mountains', 'Mountains'],
  ['fields', 'Fields'],
  ['buildings', 'Buildings'],
  ['water', 'Water'],
  ['animals', 'Animals'],
  ['total', 'Total'],
];

export function HarmoniesGameView({
  message,
  players,
  sendAction,
  disabled,
}: GameViewProps<HarmoniesView, HarmoniesAction>) {
  const view = message.state;
  const me = message.viewerPlayerId;
  const { legal, turn } = view;
  const playing = view.phase === 'PLAYING';
  const isMyTurn = !disabled && playing && turn.activePlayerId === me;
  const myBoard = me === null ? undefined : view.boards[me];
  const [selection, setSelection] = useState<Selection>(null);

  // A selection only makes sense for the state it was made in.
  useEffect(() => setSelection(null), [message.version]);

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

  // What to do next, read off what the engine says is possible right now. It goes by whose
  // turn it is rather than `isMyTurn`, so it does not flicker while an action is in flight.
  const mine = playing && turn.activePlayerId === me;
  const hasPlaceable = turn.hand.some((color) => (legal.tokenCells[color]?.length ?? 0) > 0);
  const status = !playing
    ? 'Game over.'
    : !mine
      ? `${playerName(players, turn.activePlayerId)} is playing${turn.hand.length > 0 ? ', holding' : '.'}`
      : selection
        ? 'Pick a highlighted cell on your board.'
        : legal.canTakeTokens
          ? 'Take three tokens from the central board.'
          : hasPlaceable
            ? 'Pick a token, then a cell on your board.'
            : 'Take a card, place an animal, or end your turn.';

  const inProgress = myBoard?.cards.filter((entry) => !entry.complete) ?? [];

  // Everyone but the viewer, in play order. A spectator sees every board this way.
  const others = view.turnOrder.filter((playerId) => playerId !== me || !myBoard);

  // One bar for the turn, always there and always the same size: what to do or who is
  // playing, the tokens in hand, and the end of the turn. Nothing around it moves as the
  // turn passes from player to player.
  const statusBar = (
    <div className="harmonies-status">
      <p className="harmonies-step" aria-live="polite">
        {status}
      </p>
      <div className="harmonies-hand">
        {turn.hand.map((color, index) => {
          const placeable = (legal.tokenCells[color]?.length ?? 0) > 0;
          const selected = selection?.kind === 'token' && selection.color === color;
          return mine ? (
            <button
              key={index}
              type="button"
              className={selected ? 'token-button selected' : 'token-button'}
              disabled={!isMyTurn || !placeable}
              aria-pressed={selected}
              onClick={() => setSelection(selected ? null : { kind: 'token', color })}
            >
              <TokenChip color={color} />
              <span className="token-label" aria-hidden="true">
                {TOKEN_LABEL[color]}
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
          disabled={!isMyTurn || !legal.canEndTurn}
          onClick={() => sendAction({ type: 'END_TURN' })}
        >
          End turn
        </button>
      )}
    </div>
  );

  return (
    <div className="stack harmonies">
      <header className="harmonies-banner">
        <p className="harmonies-turn">
          {view.phase === 'FINISHED'
            ? 'Game over'
            : isMyTurn
              ? 'Your turn'
              : `${playerName(players, turn.activePlayerId)}’s turn`}
          {view.finalRound && playing && <span className="harmonies-final">Final round</span>}
        </p>
        <p className="muted">
          {view.map.name} · turn {turn.number} · {view.pouchCount} tokens in the pouch
        </p>
      </header>

      <div className={myBoard ? 'harmonies-table' : 'harmonies-table watching'}>
        <div className="harmonies-main">
          <section className="card">
            <h2>Central board</h2>
            <div className="harmonies-spaces">
              {view.centralSpaces.map((space, index) => (
                <button
                  key={index}
                  type="button"
                  className="central-space"
                  disabled={!isMyTurn || !legal.canTakeTokens || space.length === 0}
                  aria-label={`Take ${space.map((color) => TOKEN_LABEL[color]).join(', ') || 'nothing'}`}
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

          {myBoard && me !== null && (
            <section className={mine ? 'card harmonies-mine active' : 'card harmonies-mine'}>
              <h2 className="harmonies-player-name">
                <span>
                  Your board
                  {view.winnerPlayerIds.includes(me) && ' 🏆'}
                </span>
                <span className="harmonies-score">
                  {view.scores[me]?.total ?? 0} <span className="muted">pts</span>
                </span>
              </h2>
              {statusBar}
              <div className="harmonies-mine-body">
                <HexBoard
                  cells={view.boardCells}
                  board={myBoard}
                  label="Your board"
                  targets={isMyTurn ? targets : undefined}
                  onSelect={placeAt}
                />
                <div className="harmonies-mine-side">
                  {myBoard.cards.length === 0 && (
                    <p className="muted hint">
                      You have no animal cards yet. Take one from the row below.
                    </p>
                  )}
                  {inProgress.length > 0 && (
                    <div className="harmonies-cards">
                      {inProgress.map(({ card, cubesPlaced }) => {
                        const selected = selection?.kind === 'card' && selection.cardId === card.id;
                        const canPlace = isMyTurn && (legal.cubeCells[card.id]?.length ?? 0) > 0;
                        return (
                          <AnimalCardView
                            key={card.id}
                            card={card}
                            cubesPlaced={cubesPlaced}
                            selected={selected}
                            action={
                              <button
                                type="button"
                                disabled={!canPlace}
                                aria-pressed={selected}
                                onClick={() =>
                                  setSelection(selected ? null : { kind: 'card', cardId: card.id })
                                }
                              >
                                {selected ? 'Cancel' : 'Place animal'}
                              </button>
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

          <section className="card">
            <h2>
              Animal cards <span className="muted">({view.cardDeckCount} in the deck)</span>
            </h2>
            <div className="harmonies-cards">
              {view.cardRiver.map((card) => (
                <AnimalCardView
                  key={card.id}
                  card={card}
                  action={
                    myBoard && playing ? (
                      <button
                        type="button"
                        disabled={!isMyTurn || !legal.canTakeCard}
                        onClick={() => sendAction({ type: 'TAKE_CARD', cardId: card.id })}
                      >
                        Take
                      </button>
                    ) : undefined
                  }
                />
              ))}
            </div>
            <p className="muted hint">
              Each card shows the exact stacks its animal needs; the number is the stack&apos;s
              height. A building is a red token on top of a grey, brown or red one.
            </p>
          </section>
        </div>

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
                points={view.scores[playerId]?.total ?? 0}
                active={playing && turn.activePlayerId === playerId}
                winner={view.winnerPlayerIds.includes(playerId)}
              />
            );
          })}
        </div>
      </div>

      <section className="card">
        <h2>Scores</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Player</th>
              {SCORE_COLUMNS.map(([, label]) => (
                <th key={label} scope="col" className="num">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.turnOrder.map((playerId) => (
              <tr key={playerId}>
                <th scope="row">
                  {playerName(players, playerId)}
                  {playerId === me && <span className="muted"> (you)</span>}
                </th>
                {SCORE_COLUMNS.map(([key]) => (
                  <td key={key} className="num">
                    {view.scores[playerId]?.[key] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ScoringGuide view={view} />
    </div>
  );
}
