import {
  GEM_COLORS,
  TIERS,
  TOKEN_COLORS,
  type GemColor,
  type SplendorAction,
  type SplendorView,
  type Tier,
  type TokenColor,
  type TokenCounts,
} from '@bgp/game-splendor';
import { useEffect, useState } from 'react';
import { playerName, type GameViewProps } from '../types';
import { CardBack, DevCardView } from './components/DevCard';
import { GemToken, gemStyle } from './components/GemToken';
import { NobleTile } from './components/NobleTile';
import { PlayerPanel } from './components/PlayerPanel';
import { TIER_LABEL, TOKEN_LABEL } from './layout';

/** The card or deck the player has picked and is about to buy or reserve. UI state only. */
type Selection = { kind: 'card'; cardId: string } | { kind: 'deck'; tier: Tier } | null;

/** The printed table has the dearest cards on top. */
const ROWS = [...TIERS].reverse();

export function SplendorGameView({
  message,
  players,
  sendAction,
  disabled,
}: GameViewProps<SplendorView, SplendorAction>) {
  const view = message.state;
  const me = message.viewerPlayerId;
  const { legal, turn } = view;
  const isMyTurn = !disabled && view.phase === 'PLAYING' && turn.activePlayerId === me;
  const mine = me === null ? undefined : view.players[me];

  const [picked, setPicked] = useState<GemColor[]>([]);
  const [returning, setReturning] = useState<Partial<TokenCounts>>({});
  const [selection, setSelection] = useState<Selection>(null);

  // What was picked only makes sense for the state it was picked in.
  useEffect(() => {
    setPicked([]);
    setReturning({});
    setSelection(null);
  }, [message.version]);

  // The engine says which colours and how many; this only keeps the pick in one of the two
  // shapes it accepts: different colours, or one colour twice.
  const isDouble = picked.length === 2 && picked[0] === picked[1];
  const canPick = (color: GemColor) => {
    if (!isMyTurn || isDouble) return false;
    if (picked.length === 1 && picked[0] === color) return legal.doubleColors.includes(color);
    if (picked.includes(color)) return false;
    return picked.length < legal.takeCount && legal.gemColors.includes(color);
  };
  const canTake = isMyTurn && picked.length > 0 && (isDouble || picked.length === legal.takeCount);

  const returnCount = TOKEN_COLORS.reduce((sum, color) => sum + (returning[color] ?? 0), 0);
  const giveBack = (color: TokenColor, delta: 1 | -1) =>
    setReturning((current) => ({ ...current, [color]: (current[color] ?? 0) + delta }));

  const selectedCardId = selection?.kind === 'card' ? selection.cardId : null;
  const toggleCard = (cardId: string) =>
    setSelection(selectedCardId === cardId ? null : { kind: 'card', cardId });
  const toggleDeck = (tier: Tier) =>
    setSelection(
      selection?.kind === 'deck' && selection.tier === tier ? null : { kind: 'deck', tier },
    );
  const canBuy = isMyTurn && selectedCardId !== null && legal.buyable.includes(selectedCardId);
  const canReserve =
    isMyTurn &&
    (selection?.kind === 'deck'
      ? legal.reservableTiers.includes(selection.tier)
      : selectedCardId !== null && legal.reservable.includes(selectedCardId));

  // The viewer's own panel first; spectators see play order.
  const panelOrder = [...view.turnOrder].sort((a, b) => Number(b === me) - Number(a === me));

  return (
    <div className="stack splendor">
      <p className="splendor-banner">
        {view.phase === 'FINISHED'
          ? 'Game over'
          : isMyTurn
            ? 'Your turn'
            : `${playerName(players, turn.activePlayerId)}’s turn`}
        {view.finalRound && view.phase === 'PLAYING' && ' · final round'}
        <span className="muted">
          {' '}
          · first to {view.targetScore} points · turn {turn.number}
        </span>
      </p>

      {isMyTurn && mine && legal.mustReturn > 0 && (
        <section className="card splendor-prompt">
          <h2>
            Give back {legal.mustReturn} {legal.mustReturn === 1 ? 'token' : 'tokens'}
          </h2>
          <p className="muted splendor-hint">You may keep 10 at most. Pick the ones to return.</p>
          <div className="row wrap">
            {TOKEN_COLORS.filter((color) => mine.tokens[color] > 0).map((color) => {
              const given = returning[color] ?? 0;
              return (
                <span key={color} className="splendor-stepper">
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`Keep one more ${TOKEN_LABEL[color]}`}
                    disabled={given === 0}
                    onClick={() => giveBack(color, -1)}
                  >
                    −
                  </button>
                  <GemToken color={color} count={given} />
                  <span className="muted">of {mine.tokens[color]}</span>
                  <button
                    type="button"
                    className="secondary"
                    aria-label={`Return one ${TOKEN_LABEL[color]}`}
                    disabled={given >= mine.tokens[color] || returnCount >= legal.mustReturn}
                    onClick={() => giveBack(color, 1)}
                  >
                    +
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              disabled={returnCount !== legal.mustReturn}
              onClick={() => sendAction({ type: 'RETURN_GEMS', tokens: returning })}
            >
              Return {returnCount}/{legal.mustReturn}
            </button>
          </div>
        </section>
      )}

      {isMyTurn && legal.nobleChoices.length > 0 && (
        <section className="card splendor-prompt">
          <h2>Two nobles want to visit: choose one</h2>
          <div className="row wrap">
            {view.nobles
              .filter((noble) => legal.nobleChoices.includes(noble.id))
              .map((noble) => (
                <NobleTile
                  key={noble.id}
                  noble={noble}
                  action={
                    <button
                      type="button"
                      onClick={() => sendAction({ type: 'CHOOSE_NOBLE', nobleId: noble.id })}
                    >
                      Choose
                    </button>
                  }
                />
              ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2>Nobles</h2>
        {view.nobles.length === 0 ? (
          <p className="muted splendor-hint">Every noble has found a host.</p>
        ) : (
          <div className="row wrap">
            {view.nobles.map((noble) => (
              <NobleTile key={noble.id} noble={noble} />
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Bank</h2>
        <div className="row wrap">
          {GEM_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="splendor-bank-token"
              style={gemStyle(color)}
              aria-label={`Take ${TOKEN_LABEL[color]}, ${view.bank[color]} in the bank`}
              disabled={!canPick(color)}
              onClick={() => setPicked([...picked, color])}
            >
              {view.bank[color]}
            </button>
          ))}
          <span
            className="splendor-bank-token gold"
            style={gemStyle('gold')}
            title="Gold comes with a reserved card and pays for any colour"
          >
            {view.bank.gold}
            <span className="sr-only"> Gold in the bank</span>
          </span>
        </div>
        {mine && view.phase === 'PLAYING' && (
          <div className="row wrap">
            <span>Taking:</span>
            {picked.length === 0 ? (
              <span className="muted">
                3 different colours, or 2 of one colour from a pile of 4 or more
              </span>
            ) : (
              picked.map((color, index) => <GemToken key={index} color={color} small />)
            )}
            <button
              type="button"
              disabled={!canTake}
              onClick={() => sendAction({ type: 'TAKE_GEMS', colors: picked })}
            >
              Take
            </button>
            <button
              type="button"
              className="secondary"
              disabled={picked.length === 0}
              onClick={() => setPicked([])}
            >
              Clear
            </button>
            {isMyTurn && legal.canPass && (
              <button type="button" onClick={() => sendAction({ type: 'PASS' })}>
                Pass (no move left)
              </button>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Cards</h2>
        <div className="splendor-market">
          {ROWS.map((tier) => (
            <div key={tier} className="splendor-row">
              <CardBack
                tier={tier}
                count={view.deckCounts[tier]}
                selected={selection?.kind === 'deck' && selection.tier === tier}
                onSelect={mine ? () => toggleDeck(tier) : undefined}
                disabled={!isMyTurn || !legal.reservableTiers.includes(tier)}
              />
              {view.market[tier].map((card, slot) =>
                card ? (
                  <DevCardView
                    key={card.id}
                    card={card}
                    affordable={legal.buyable.includes(card.id)}
                    note={legal.buyable.includes(card.id) ? 'You can afford this' : undefined}
                    selected={selectedCardId === card.id}
                    onSelect={mine ? () => toggleCard(card.id) : undefined}
                    disabled={!isMyTurn || legal.mustReturn > 0 || legal.nobleChoices.length > 0}
                  />
                ) : (
                  <div key={slot} className="splendor-card empty" aria-label="Empty slot" />
                ),
              )}
            </div>
          ))}
        </div>
        {mine && view.phase === 'PLAYING' && (
          <div className="row wrap">
            <span className="muted">
              {selection === null
                ? 'Pick a card to buy or reserve, or a deck to reserve its top card unseen.'
                : selection.kind === 'deck'
                  ? `Top card of deck ${TIER_LABEL[selection.tier]}, unseen.`
                  : canBuy
                    ? 'You can afford this card.'
                    : 'You cannot afford this card yet.'}
            </span>
            <button
              type="button"
              disabled={!canBuy}
              onClick={() =>
                selectedCardId && sendAction({ type: 'BUY_CARD', cardId: selectedCardId })
              }
            >
              Buy
            </button>
            <button
              type="button"
              disabled={!canReserve}
              onClick={() => {
                if (selection?.kind === 'deck') {
                  sendAction({ type: 'RESERVE_FROM_DECK', tier: selection.tier });
                } else if (selectedCardId) {
                  sendAction({ type: 'RESERVE_CARD', cardId: selectedCardId });
                }
              }}
            >
              Reserve{view.bank.gold > 0 ? ' (+1 gold)' : ''}
            </button>
          </div>
        )}
      </section>

      <div className="splendor-players">
        {panelOrder.map((playerId) => {
          const player = view.players[playerId];
          if (!player) return null;
          const own = playerId === me;
          return (
            <PlayerPanel
              key={playerId}
              name={playerName(players, playerId)}
              player={player}
              mine={own}
              active={view.phase === 'PLAYING' && turn.activePlayerId === playerId}
              winner={view.winnerPlayerIds.includes(playerId)}
              buyable={own ? legal.buyable : []}
              selectedCardId={own ? selectedCardId : null}
              onSelectCard={own && isMyTurn ? toggleCard : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
