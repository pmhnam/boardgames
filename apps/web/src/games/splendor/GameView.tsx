import {
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
import { Bank } from './components/Bank';
import { CardSlot } from './components/CardActions';
import { CardBack, DevCardView, describeMissing } from './components/DevCard';
import { GemToken } from './components/GemToken';
import { NobleTile } from './components/NobleTile';
import { PlayerPanel } from './components/PlayerPanel';
import { TIER_LABEL, TOKEN_LABEL } from './layout';
import { useLastMove } from './useLastMove';
import { useTurnAlerts } from '../shared/useTurnAlerts';

const TURN_ALERTS = {
  preferenceKey: 'splendor',
  title: 'Splendor — Đến lượt bạn',
  body: 'Quay lại game để gom đá quý, mua thẻ hoặc chiêu mộ quý tộc.',
};

/** The card or deck the player has picked and is about to buy or reserve. UI state only. */
type Selection = { kind: 'card'; cardId: string } | { kind: 'deck'; tier: Tier } | null;

/** The printed table has the dearest cards on top. */
const ROWS = [...TIERS].reverse();

export function SplendorGameView({
  message,
  players,
  sendAction,
  disabled,
  autoplay,
}: GameViewProps<SplendorView, SplendorAction>) {
  const view = message.state;
  const me = message.viewerPlayerId;
  const { legal, turn } = view;
  const playing = view.phase === 'PLAYING';
  const mineTurn = playing && me !== null && turn.activePlayerId === me;
  const isMyTurn = !disabled && !autoplay?.enabled && !autoplay?.pending && mineTurn;
  const alerts = useTurnAlerts(
    {
      gameId: message.gameId,
      playerId: me,
      number: turn.number,
      mine: mineTurn && message.status === 'playing' && autoplay !== undefined && !autoplay.enabled,
    },
    TURN_ALERTS,
  );
  const mine = me === null ? undefined : view.players[me];
  /** Seated in a game still going: the only viewer who gets controls. */
  const interactive = mine !== undefined && playing;
  const lastMove = useLastMove(message);

  const [picked, setPicked] = useState<GemColor[]>([]);
  const [returning, setReturning] = useState<Partial<TokenCounts>>({});
  const [selection, setSelection] = useState<Selection>(null);

  // What was picked only makes sense for the state it was picked in.
  useEffect(() => {
    setPicked([]);
    setReturning({});
    setSelection(null);
  }, [message.version]);

  // The actions sit under the selected card; Escape or a click elsewhere puts it down.
  useEffect(() => {
    if (selection === null) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setSelection(null);
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.splendor-slot')) {
        setSelection(null);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [selection]);

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
  const reserveLabel = `Reserve${view.bank.gold > 0 ? ' (+1 gold)' : ''}`;

  /** The buttons under a selected card. What they allow is the engine's call, via `legal`. */
  const cardActions = (cardId: string, reservable: boolean) => {
    const shortfall = view.shortfalls[cardId];
    const canBuy = isMyTurn && legal.buyable.includes(cardId);
    return (
      <>
        <span className="muted">
          {!shortfall || shortfall.short === 0
            ? 'You can afford this card.'
            : `Short of ${describeMissing(shortfall)}.`}
        </span>
        <button
          type="button"
          disabled={!canBuy}
          onClick={() => sendAction({ type: 'BUY_CARD', cardId })}
        >
          Buy
        </button>
        {reservable && (
          <button
            type="button"
            className="secondary"
            disabled={!isMyTurn || !legal.reservable.includes(cardId)}
            onClick={() => sendAction({ type: 'RESERVE_CARD', cardId })}
          >
            {reserveLabel}
          </button>
        )}
      </>
    );
  };

  const renderPlayer = (playerId: string) => {
    const player = view.players[playerId];
    if (!player) return null;
    const own = playerId === me;
    return (
      <PlayerPanel
        key={playerId}
        name={playerName(players, playerId)}
        player={player}
        targetScore={view.targetScore}
        mine={own}
        active={playing && turn.activePlayerId === playerId}
        winner={view.winnerPlayerIds.includes(playerId)}
        lastMove={lastMove?.playerId === playerId ? lastMove.text : undefined}
        shortfalls={own ? view.shortfalls : {}}
        selectedCardId={own ? selectedCardId : null}
        onSelectCard={own && interactive ? toggleCard : undefined}
        cardActions={own && selectedCardId ? cardActions(selectedCardId, false) : undefined}
      />
    );
  };

  return (
    <div className="stack splendor">
      <header className="splendor-banner">
        <p className="splendor-turn">
          {view.phase === 'FINISHED'
            ? 'Game over'
            : mineTurn
              ? 'Your turn'
              : `${playerName(players, turn.activePlayerId)}’s turn`}
          {view.finalRound && playing && <span className="splendor-final">Final round</span>}
        </p>
        <p className="muted" aria-live="polite">
          {lastMove
            ? `${lastMove.playerId === me ? 'You' : playerName(players, lastMove.playerId)} ${lastMove.text}. `
            : ''}
          First to {view.targetScore} points · turn {turn.number}
        </p>
      </header>

      {autoplay && me !== null && playing && message.status === 'playing' && (
        <div className="stack">
          <div className="row wrap" aria-label="Bot chơi giúp và âm báo tới lượt">
            {autoplay && (
              <button
                type="button"
                aria-pressed={autoplay.enabled}
                disabled={autoplay.pending || (!autoplay.enabled && disabled)}
                onClick={autoplay.toggle}
              >
                {autoplay.pending
                  ? 'Đang chuyển quyền…'
                  : autoplay.enabled
                    ? 'Lấy lại quyền chơi'
                    : '🤖 Bật bot chơi giùm'}
              </button>
            )}
            <button type="button" aria-pressed={alerts.sound} onClick={alerts.toggleSound}>
              {alerts.sound ? '🔊 Âm thanh: Bật' : '🔇 Âm thanh: Tắt'}
            </button>
          </div>
          {autoplay?.enabled && (
            <p className="muted hint" role="status">
              Bot đang chơi giùm bạn (mức thường), liên tục đến khi bạn tắt.
            </p>
          )}
          {autoplay?.error && (
            <p className="error" role="alert">
              {autoplay.error}
            </p>
          )}
        </div>
      )}

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

      <div className="splendor-table">
        <section className="card splendor-board" aria-label="Table">
          <div className="splendor-nobles" aria-label="Available nobles">
            {view.nobles.length === 0 ? (
              <span className="muted">Every noble has found a host.</span>
            ) : (
              view.nobles.map((noble) => (
                <NobleTile key={noble.id} noble={noble} bonuses={mine?.bonuses} />
              ))
            )}
          </div>

          <div className="splendor-market">
            {ROWS.map((tier) => (
              <div key={tier} className="splendor-row">
                <CardSlot
                  open={selection?.kind === 'deck' && selection.tier === tier}
                  card={
                    <CardBack
                      tier={tier}
                      count={view.deckCounts[tier]}
                      selected={selection?.kind === 'deck' && selection.tier === tier}
                      onSelect={interactive ? () => toggleDeck(tier) : undefined}
                      disabled={view.deckCounts[tier] === 0}
                    />
                  }
                >
                  <span className="muted">Top card of deck {TIER_LABEL[tier]}, unseen.</span>
                  <button
                    type="button"
                    disabled={!isMyTurn || !legal.reservableTiers.includes(tier)}
                    onClick={() => sendAction({ type: 'RESERVE_FROM_DECK', tier })}
                  >
                    {reserveLabel}
                  </button>
                </CardSlot>
                {view.market[tier].map((card, slot) =>
                  card ? (
                    <CardSlot
                      key={card.id}
                      open={selectedCardId === card.id}
                      alignEnd={slot >= 2}
                      card={
                        <DevCardView
                          card={card}
                          shortfall={view.shortfalls[card.id]}
                          fresh={lastMove?.freshCardIds.includes(card.id)}
                          selected={selectedCardId === card.id}
                          onSelect={interactive ? () => toggleCard(card.id) : undefined}
                        />
                      }
                    >
                      {cardActions(card.id, true)}
                    </CardSlot>
                  ) : (
                    <div key={slot} className="splendor-card empty" aria-label="Empty slot" />
                  ),
                )}
              </div>
            ))}
          </div>

          <Bank
            bank={view.bank}
            legal={legal}
            interactive={interactive}
            isMyTurn={isMyTurn}
            picked={picked}
            onPick={setPicked}
            onTake={() => sendAction({ type: 'TAKE_GEMS', colors: picked })}
            onPass={() => sendAction({ type: 'PASS' })}
          />
        </section>

        <div className="splendor-side">
          {view.turnOrder.filter((playerId) => playerId !== me).map(renderPlayer)}
        </div>
        {mine && me !== null && <div className="splendor-mine">{renderPlayer(me)}</div>}
      </div>
    </div>
  );
}
