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
import { HexBoard } from './components/HexBoard';
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
  const isMyTurn = !disabled && view.phase === 'PLAYING' && turn.activePlayerId === me;
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

  // The viewer's own board first; spectators see play order.
  const boardOrder = [...view.turnOrder].sort((a, b) => Number(b === me) - Number(a === me));

  return (
    <div className="stack harmonies">
      <p className="turn-banner">
        {view.phase === 'FINISHED'
          ? 'Game over'
          : isMyTurn
            ? 'Your turn'
            : `${playerName(players, turn.activePlayerId)}’s turn`}
        {view.finalRound && view.phase === 'PLAYING' && ' · final round'}
        <span className="muted">
          {' '}
          · {view.map.name} · turn {turn.number} · {view.pouchCount} tokens in the pouch
        </span>
      </p>

      <section className="card">
        <h2>Central board</h2>
        <div className="row wrap">
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

        {turn.hand.length > 0 && (
          <div className="row wrap hand">
            <span>{isMyTurn ? 'Place:' : 'In hand:'}</span>
            {turn.hand.map((color, index) => {
              const placeable = (legal.tokenCells[color]?.length ?? 0) > 0;
              const selected = selection?.kind === 'token' && selection.color === color;
              return (
                <button
                  key={index}
                  type="button"
                  className={selected ? 'token-button selected' : 'token-button'}
                  disabled={!isMyTurn || !placeable}
                  aria-pressed={selected}
                  onClick={() => setSelection(selected ? null : { kind: 'token', color })}
                >
                  <TokenChip color={color} /> {TOKEN_LABEL[color]}
                </button>
              );
            })}
          </div>
        )}

        {isMyTurn && (
          <div className="row">
            <button
              type="button"
              disabled={!legal.canEndTurn}
              onClick={() => sendAction({ type: 'END_TURN' })}
            >
              End turn
            </button>
            {!legal.canEndTurn && (
              <span className="muted">
                {turn.tokensTaken ? 'Place your tokens to end the turn.' : 'Take three tokens.'}
              </span>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>
          Animal cards <span className="muted">({view.cardDeckCount} in the deck)</span>
        </h2>
        <div className="row wrap">
          {view.cardRiver.map((card) => (
            <AnimalCardView
              key={card.id}
              card={card}
              action={
                <button
                  type="button"
                  disabled={!isMyTurn || !legal.canTakeCard}
                  onClick={() => sendAction({ type: 'TAKE_CARD', cardId: card.id })}
                >
                  Take
                </button>
              }
            />
          ))}
        </div>
      </section>

      <div className="boards">
        {boardOrder.map((playerId) => {
          const board = view.boards[playerId];
          if (!board) return null;
          const mine = playerId === me;
          return (
            <section key={playerId} className={mine ? 'card board mine' : 'card board'}>
              <h2>
                {playerName(players, playerId)}
                {mine && <span className="muted"> (you)</span>}
                {view.winnerPlayerIds.includes(playerId) && ' 🏆'}
                <span className="muted"> · {view.scores[playerId]?.total ?? 0} pts</span>
              </h2>
              <HexBoard
                cells={view.boardCells}
                board={board}
                label={`${playerName(players, playerId)}'s board`}
                width={mine ? 360 : 240}
                targets={mine && isMyTurn ? targets : undefined}
                onSelect={placeAt}
              />
              <div className="row wrap">
                {board.cards.map(({ card, cubesPlaced, complete }) => {
                  const selected = selection?.kind === 'card' && selection.cardId === card.id;
                  const canPlace = mine && isMyTurn && (legal.cubeCells[card.id]?.length ?? 0) > 0;
                  return (
                    <AnimalCardView
                      key={card.id}
                      card={card}
                      cubesPlaced={cubesPlaced}
                      selected={selected}
                      action={
                        complete ? (
                          <span className="muted">Complete</span>
                        ) : mine ? (
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
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
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
                <th scope="row">{playerName(players, playerId)}</th>
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
    </div>
  );
}
