import {
  TIERS,
  type CardShortfall,
  type DevelopmentCard,
  type GemColor,
  type SplendorAction,
  type SplendorView,
  type Tier,
} from '@bgp/game-splendor';
import { memo, useEffect, useState } from 'react';
import { playerName, type GameViewProps } from '../types';
import { Bank } from './components/Bank';
import { CardSlot } from './components/CardActions';
import { CardBack, DevCardView, describeMissing } from './components/DevCard';
import { NobleTile } from './components/NobleTile';
import { PlayerPanel } from './components/PlayerPanel';
import { ReturnPrompt } from './components/ReturnPrompt';
import { TIER_LABEL } from './layout';
import { useLastMove } from './useLastMove';
import { useSharedView } from '../shared/useSharedView';
import { useStableHandler } from '../shared/useStableHandler';
import { useTurnAlerts } from '../shared/useTurnAlerts';
import { HeaderControls } from '../../shared/components/HeaderControls';
import './splendor.css';

const TURN_ALERTS = {
  preferenceKey: 'splendor',
  title: 'Splendor — Đến lượt bạn',
  body: 'Quay lại game để gom đá quý, mua thẻ hoặc chiêu mộ quý tộc.',
};

/** The card or deck the player has picked and is about to buy or reserve. UI state only. */
type Selection = { kind: 'card'; cardId: string } | { kind: 'deck'; tier: Tier };

/** The printed table has the dearest cards on top. */
const ROWS = [...TIERS].reverse();

const NO_SHORTFALLS: SplendorView['shortfalls'] = {};

/**
 * A card on the table. Drawn again only when something about this card changed: what it is
 * told is plain values and a handler that stays the same, never a function made per render.
 */
const MarketCard = memo(function MarketCard({
  card,
  shortfall,
  fresh,
  selected,
  onToggle,
}: {
  card: DevelopmentCard;
  shortfall?: CardShortfall;
  fresh: boolean;
  selected: boolean;
  onToggle?: (cardId: string) => void;
}) {
  return (
    <DevCardView
      card={card}
      shortfall={shortfall}
      fresh={fresh}
      selected={selected}
      onSelect={onToggle && (() => onToggle(card.id))}
    />
  );
});

const Deck = memo(function Deck({
  tier,
  count,
  selected,
  onToggle,
}: {
  tier: Tier;
  count: number;
  selected: boolean;
  onToggle?: (tier: Tier) => void;
}) {
  return (
    <CardBack
      tier={tier}
      count={count}
      selected={selected}
      onSelect={onToggle && (() => onToggle(tier))}
      disabled={count === 0}
    />
  );
});

export function SplendorGameView({
  message,
  players,
  sendAction,
  disabled,
  autoplay,
}: GameViewProps<SplendorView, SplendorAction>) {
  // Parts of the table that did not change keep their identity, so their components can rest.
  const view = useSharedView(message.state);
  const me = message.viewerPlayerId;
  const { legal, turn } = view;
  const playing = view.phase === 'PLAYING';
  const mineTurn = playing && me !== null && turn.activePlayerId === me;
  /** The viewer's own move to make, rather than the server's bot making it for them. */
  const myMove = mineTurn && !autoplay?.enabled;
  // Whether a click would be taken right now. What is shown goes by `myMove` instead, so
  // nothing flickers while an action is in flight.
  const isMyTurn = myMove && !disabled && !autoplay?.pending;
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

  /**
   * What the player has in hand, and the state it is put down after: the one their own action
   * was sent in. Someone else's move leaves it in hand, as long as it is still on the table.
   */
  const [held, setHeld] = useState<{ pick: Selection; until?: number } | null>(null);
  const stillThere = (pick: Selection) =>
    pick.kind === 'deck'
      ? view.deckCounts[pick.tier] > 0
      : TIERS.some((tier) => view.market[tier].some((card) => card?.id === pick.cardId)) ||
        mine?.reserved.some((entry) => !entry.hidden && entry.card.id === pick.cardId) === true;
  const selection: Selection | null =
    held !== null &&
    (held.until === undefined || held.until === message.version) &&
    stillThere(held.pick)
      ? held.pick
      : null;
  const select = (pick: Selection | null) => setHeld(pick && { pick });

  /** The action last sent, and the state it was sent in: its button is busy until answered. */
  const [sent, setSent] = useState<{ version: number; key: string } | null>(null);
  const act = (key: string, action: SplendorAction) => {
    setSent({ version: message.version, key });
    setHeld((current) => current && { ...current, until: message.version });
    sendAction(action);
  };
  const busy = (key: string) =>
    (disabled && sent?.version === message.version && sent.key === key) || undefined;

  // The actions sit under the selected card; Escape or a click elsewhere puts it down.
  const holding = selection !== null;
  useEffect(() => {
    if (!holding) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setHeld(null);
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.splendor-slot')) {
        setHeld(null);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [holding]);

  const selectedCardId = selection?.kind === 'card' ? selection.cardId : null;
  const selectedTier = selection?.kind === 'deck' ? selection.tier : null;
  const toggleCard = useStableHandler((cardId: string) =>
    select(selectedCardId === cardId ? null : { kind: 'card', cardId }),
  );
  const toggleDeck = useStableHandler((tier: Tier) =>
    select(selectedTier === tier ? null : { kind: 'deck', tier }),
  );
  const takeGems = useStableHandler((colors: GemColor[]) =>
    act('take', { type: 'TAKE_GEMS', colors }),
  );
  const pass = useStableHandler(() => act('pass', { type: 'PASS' }));
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
          aria-busy={busy(`buy:${cardId}`)}
          onClick={() => act(`buy:${cardId}`, { type: 'BUY_CARD', cardId })}
        >
          Buy
        </button>
        {reservable && (
          <button
            type="button"
            className="secondary"
            disabled={!isMyTurn || !legal.reservable.includes(cardId)}
            aria-busy={busy(`reserve:${cardId}`)}
            onClick={() => act(`reserve:${cardId}`, { type: 'RESERVE_CARD', cardId })}
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
        shortfalls={own ? view.shortfalls : NO_SHORTFALLS}
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
        <>
          <HeaderControls>
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
          </HeaderControls>
          {autoplay?.enabled && (
            <p className="muted splendor-control-status" role="status">
              Bot đang chơi giùm bạn (mức thường), liên tục đến khi bạn tắt.
            </p>
          )}
          {autoplay?.error && (
            <p className="error" role="alert">
              {autoplay.error}
            </p>
          )}
        </>
      )}

      {myMove && mine && legal.mustReturn > 0 && (
        <ReturnPrompt
          key={message.version}
          tokens={mine.tokens}
          mustReturn={legal.mustReturn}
          canAct={isMyTurn}
          busy={busy('return')}
          onReturn={(tokens) => act('return', { type: 'RETURN_GEMS', tokens })}
        />
      )}

      {myMove && legal.nobleChoices.length > 0 && (
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
                      disabled={!isMyTurn}
                      aria-busy={busy(`noble:${noble.id}`)}
                      onClick={() =>
                        act(`noble:${noble.id}`, { type: 'CHOOSE_NOBLE', nobleId: noble.id })
                      }
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
                  open={selectedTier === tier}
                  card={
                    <Deck
                      tier={tier}
                      count={view.deckCounts[tier]}
                      selected={selectedTier === tier}
                      onToggle={interactive ? toggleDeck : undefined}
                    />
                  }
                >
                  {selectedTier === tier && (
                    <>
                      <span className="muted">Top card of deck {TIER_LABEL[tier]}, unseen.</span>
                      <button
                        type="button"
                        disabled={!isMyTurn || !legal.reservableTiers.includes(tier)}
                        aria-busy={busy(`deck:${tier}`)}
                        onClick={() => act(`deck:${tier}`, { type: 'RESERVE_FROM_DECK', tier })}
                      >
                        {reserveLabel}
                      </button>
                    </>
                  )}
                </CardSlot>
                {view.market[tier].map((card, slot) =>
                  card ? (
                    <CardSlot
                      key={card.id}
                      open={selectedCardId === card.id}
                      alignEnd={slot >= 2}
                      card={
                        <MarketCard
                          card={card}
                          shortfall={view.shortfalls[card.id]}
                          fresh={lastMove?.freshCardIds.includes(card.id) === true}
                          selected={selectedCardId === card.id}
                          onToggle={interactive ? toggleCard : undefined}
                        />
                      }
                    >
                      {selectedCardId === card.id && cardActions(card.id, true)}
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
            myMove={myMove}
            isMyTurn={isMyTurn}
            busy={busy('take') ? 'take' : busy('pass') ? 'pass' : undefined}
            version={message.version}
            onTake={takeGems}
            onPass={pass}
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
