import {
  ROLE_IDS,
  type BangAction,
  type BangView,
  type CardView,
  type PlayerView,
} from '@bgp/game-bang';
import { useEffect, useState } from 'react';
import type { Locale } from '../../shared/i18n/locales';
import { useLocale } from '../../shared/i18n/useT';
import type { TurnAlertOptions } from '../shared/turnAlerts';
import { useTurnAlerts } from '../shared/useTurnAlerts';
import { playerName, type GameViewProps } from '../types';
import { CardBack, CardFace } from './components/CardFace';
import { EventLog } from './components/EventLog';
import { Icon } from './components/Icon';
import type { SeatTile } from './components/PlayerSeat';
import { Table } from './components/Table';
import { lastLogId } from './effects';
import { seatSpots } from './layout';
import { BANG_TEXT, CHARACTER_NAME, type BangText, type NameOf } from './text';
import { useSeatEffects } from './useSeatEffects';
import '@fontsource/alfa-slab-one/400.css';
import './bang.css';

/** One object per language, so switching language is the only thing that restarts the alerts. */
const TURN_ALERTS: Record<Locale, TurnAlertOptions> = {
  vi: { preferenceKey: 'bang', ...BANG_TEXT.vi.alerts },
  en: { preferenceKey: 'bang', ...BANG_TEXT.en.alerts },
};

/**
 * What the viewer is in the middle of choosing. `play` is one card to play or to answer with,
 * `discard` the cards ending the turn costs, `heal` the two Sid Ketchum trades for a life point.
 */
type Mode = 'play' | 'discard' | 'heal';

/** What is picked but not yet sent: it only makes sense for the state it was picked in. */
interface Choice {
  version: number;
  mode: Mode;
  cards: string[];
  /** For a Panic! or a Cat Balou: whose card it is to be, while the card is still to be named. */
  targetId: string | null;
}

/** What a Panic! or a Cat Balou may take from a player: null is a card from the hand, unseen. */
function lootOptions(player: PlayerView): Array<string | null> {
  return [...(player.handCount > 0 ? [null] : []), ...player.inPlay.map((card) => card.id)];
}

/** What everyone not being asked is told the table is waiting for. */
function describeWaiting(view: BangView, nameOf: NameOf, text: BangText): string {
  const pending = view.pending;
  if (!pending) return text.waiting.turn(nameOf(view.turn.playerId));
  const who = nameOf(pending.playerId);
  const source = pending.sourceId ? nameOf(pending.sourceId) : text.ask.someone;
  switch (pending.type) {
    case 'BANG':
      return text.waiting.bang(source, who);
    case 'INDIANS':
      return text.waiting.indians(who);
    case 'DUEL':
      return text.waiting.duel(who, source);
    case 'STORE':
      return text.waiting.store(who);
    case 'DYING':
      return text.waiting.dying(who);
    default:
      return text.waiting.draw(who);
  }
}

/** The three steps of a turn, with the one the viewer is on marked. */
function Steps({ current, text }: { current: number; text: BangText }) {
  return (
    <ol className="bang-steps" aria-label={text.stepsLabel}>
      {text.steps.map((label, index) => (
        <li
          key={label}
          className={index < current ? 'done' : index === current ? 'current' : undefined}
          aria-current={index === current ? 'step' : undefined}
        >
          <span className="bang-step-dot" aria-hidden="true">
            {index < current ? <Icon name="check" /> : index + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function BangGameView({
  message,
  players,
  sendAction,
  disabled,
}: GameViewProps<BangView, BangAction>) {
  const locale = useLocale();
  const text = BANG_TEXT[locale];
  const view = message.state;
  const me = view.me;
  const legal = me?.legal;
  const prompt = disabled ? null : (legal?.prompt ?? null);
  const pending = view.pending;
  const over = view.phase === 'FINISHED';
  const nameOf: NameOf = (playerId) => playerName(players, playerId);
  const myTurn = !over && me !== null && view.turn.playerId === me.playerId;

  // One chime when a turn starts, and one each time a card of someone else's needs an answer:
  // a turn and an ask can never share a number.
  const logId = lastLogId(view.log);
  const alerts = useTurnAlerts(
    {
      gameId: message.gameId,
      playerId: me?.playerId ?? null,
      number: myTurn ? view.turn.number * 2 : logId * 2 + 1,
      mine: message.status === 'playing' && !over && legal != null && legal.prompt !== null,
    },
    TURN_ALERTS[locale],
  );
  const effects = useSeatEffects(view.log);

  const hand = me?.hand ?? [];
  const answering = prompt === 'BANG' || prompt === 'INDIANS' || prompt === 'DUEL';
  const choosing = prompt === 'STORE' || prompt === 'KIT';
  const discardCount = prompt === 'PLAY' ? (legal?.discardCount ?? 0) : 0;
  const canHeal = legal?.canHeal === true && prompt !== null;
  const firstAnswer = answering ? legal?.responses[0] : undefined;

  // Until the viewer picks, the first card that answers is already in hand, and Sid Ketchum on
  // his last breath is already choosing the two cards that keep him in.
  const [stored, setStored] = useState<Choice | null>(null);
  const choice: Choice =
    stored?.version === message.version
      ? stored
      : {
          version: message.version,
          mode: prompt === 'DYING' && canHeal ? 'heal' : 'play',
          cards: firstAnswer === undefined ? [] : [firstAnswer],
          targetId: null,
        };
  const choose = (next: Partial<Omit<Choice, 'version'>>) =>
    setStored({ ...choice, ...next, version: message.version });
  const mode: Mode =
    choice.mode === 'discard' && discardCount > 0
      ? 'discard'
      : choice.mode === 'heal' && canHeal
        ? 'heal'
        : 'play';
  const picked = choice.cards;

  // Escape puts back whatever is picked.
  const holding = stored?.version === message.version;
  useEffect(() => {
    if (!holding) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStored(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [holding]);

  const pickLimit =
    mode === 'discard'
      ? discardCount
      : mode === 'heal'
        ? 2
        : choosing
          ? (legal?.pickCount ?? 1)
          : 1;
  const pickCard = (cardId: string) =>
    choose({
      cards: picked.includes(cardId)
        ? picked.filter((id) => id !== cardId)
        : [...picked, cardId].slice(-pickLimit),
      targetId: null,
    });

  const [only] = picked.length === 1 ? picked : [];
  const play =
    prompt === 'PLAY' && mode === 'play'
      ? legal?.plays.find((option) => option.cardId === only)
      : undefined;
  const playCard = hand.find((card) => card.id === play?.cardId);
  const aimed = play !== undefined && play.targets !== null;
  // A Panic! or a Cat Balou takes a named card off the table, or one unseen from the hand.
  const takes = playCard?.kind === 'panic' || playCard?.kind === 'catBalou';
  const target = takes
    ? view.players.find((player) => player.playerId === choice.targetId)
    : undefined;
  const response =
    answering && mode === 'play' && only !== undefined && legal?.responses.includes(only)
      ? only
      : null;

  const targets =
    prompt === 'DRAW' ? (legal?.drawFromPlayers ?? []) : aimed ? (play?.targets ?? []) : [];
  const playOn = (targetId: string | null, targetCardId: string | null) => {
    if (play) sendAction({ type: 'PLAY_CARD', cardId: play.cardId, targetId, targetCardId });
  };
  /** Choosing a player is the whole move, unless there is still a card of theirs to name. */
  const pickSeat = (playerId: string) => {
    if (prompt === 'DRAW') {
      sendAction({ type: 'DRAW', source: 'player', targetId: playerId });
      return;
    }
    if (!aimed) return;
    const seat = view.players.find((player) => player.playerId === playerId);
    const options = takes && seat ? lootOptions(seat) : [];
    if (options.length > 1) {
      choose({ targetId: choice.targetId === playerId ? null : playerId });
    } else {
      playOn(playerId, options[0] ?? null);
    }
  };

  const viewerIndex = view.players.findIndex((player) => player.playerId === me?.playerId);
  const spots = seatSpots(view.players.length, viewerIndex);
  const tiles: SeatTile[] = view.players.map((player, index) => {
    const { playerId } = player;
    return {
      player,
      name: nameOf(playerId),
      isYou: playerId === me?.playerId,
      turn: !over && view.turn.playerId === playerId,
      asked: pending?.playerId === playerId && pending.type !== 'DRAW' && pending.type !== 'KIT',
      queued: pending?.waitingIds.includes(playerId) ?? false,
      winner: over && view.winnerPlayerIds.includes(playerId),
      selectable: targets.includes(playerId),
      selected: choice.targetId === playerId,
      faded: targets.length > 0 && !targets.includes(playerId) && playerId !== me?.playerId,
      effect: effects[playerId],
      spot: spots[index] ?? { x: 50, y: 50 },
    };
  });

  const offered = pending?.cards ?? [];
  const self = view.players.find((player) => player.playerId === me?.playerId);
  const cast = ROLE_IDS.filter((role) => view.roleCounts[role] > 0);
  const latest = view.log.at(-1);
  const cardName = (card: CardView | null | undefined) => (card ? text.card[card.kind] : null);
  const step = pending?.type === 'DRAW' || pending?.type === 'KIT' ? 0 : mode === 'discard' ? 2 : 1;
  const notifying = alerts.notifications && alerts.permission === 'granted';

  const healOffer = canHeal && mode !== 'heal' && (
    <button
      type="button"
      className="secondary"
      onClick={() => choose({ mode: 'heal', cards: [], targetId: null })}
    >
      {text.heal.offer}
    </button>
  );
  const passButton = (
    <button
      type="button"
      className="secondary"
      onClick={() => sendAction({ type: 'RESPOND', cardId: null })}
    >
      {prompt === 'DYING' ? text.button.giveUp : text.button.takeHit}
    </button>
  );

  return (
    <div className="bang">
      <header className={over ? 'card bang-banner over' : 'card bang-banner'}>
        <div className="bang-banner-title">
          <Icon name={over ? 'trophy' : 'hat'} />
          <div>
            <strong>
              {over && view.winner
                ? text.winner[view.winner]
                : myTurn
                  ? text.banner.yourTurn
                  : text.banner.turnOf(nameOf(view.turn.playerId))}
            </strong>
            <span className="muted">{text.banner.turnNumber(view.turn.number)}</span>
          </div>
        </div>
        {myTurn && <Steps current={step} text={text} />}
        {me && !over && (
          <div className="bang-tools" role="group" aria-label={text.tools.label}>
            <button
              type="button"
              className="bang-tool"
              aria-pressed={alerts.sound}
              onClick={alerts.toggleSound}
            >
              <Icon name={alerts.sound ? 'speaker' : 'speakerOff'} />
              <span>{alerts.sound ? text.tools.soundOn : text.tools.soundOff}</span>
            </button>
            <button
              type="button"
              className="bang-tool"
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

      <div className="bang-layout">
        <div className="bang-main">
          <Table
            tiles={tiles}
            deckCount={view.deckCount}
            discardCount={view.discardCount}
            discardTop={view.discardTop}
            news={latest ? text.log.describe(latest, nameOf) : text.table.quiet}
            onPick={pickSeat}
          />

          {!over && (
            <section className={prompt === null ? 'card bang-prompt' : 'card bang-prompt yours'}>
              {offered.length > 0 && (
                <div className="bang-offer">
                  <span className="muted hint">
                    {pending?.type === 'STORE' ? text.offer.storeLabel : text.offer.kitLabel}
                  </span>
                  <div className="bang-cards">
                    {offered.map((card) => (
                      <CardFace
                        key={card.id}
                        card={card}
                        lit={choosing}
                        selected={choosing && picked.includes(card.id)}
                        onPick={choosing ? () => pickCard(card.id) : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}

              {prompt === null && (
                <p className="bang-say muted">
                  {me ? describeWaiting(view, nameOf, text) : text.banner.watching}
                </p>
              )}

              {mode === 'heal' && (
                <>
                  <p className="bang-say">
                    {prompt === 'DYING' && `${text.ask.dying} `}
                    {text.heal.choose(picked.length)}
                  </p>
                  <div className="row wrap">
                    <button
                      type="button"
                      disabled={picked.length !== 2}
                      onClick={() => sendAction({ type: 'DISCARD_TO_HEAL', cardIds: picked })}
                    >
                      {text.heal.confirm}
                    </button>
                    {prompt === 'DYING' ? (
                      passButton
                    ) : (
                      <button type="button" className="secondary" onClick={() => setStored(null)}>
                        {text.button.back}
                      </button>
                    )}
                  </div>
                </>
              )}

              {mode === 'discard' && (
                <>
                  <p className="bang-say">{text.discard.choose(discardCount, picked.length)}</p>
                  <div className="row wrap">
                    <button
                      type="button"
                      disabled={picked.length !== discardCount}
                      onClick={() => sendAction({ type: 'END_TURN', discardIds: picked })}
                    >
                      {text.button.discardAndEnd(discardCount)}
                    </button>
                    <button type="button" className="secondary" onClick={() => setStored(null)}>
                      {text.button.back}
                    </button>
                  </div>
                </>
              )}

              {prompt === 'PLAY' && mode === 'play' && (
                <>
                  <p className="bang-say">
                    {!play && (legal?.plays.length ? text.play.choose : text.play.nothing)}
                    {play && !aimed && text.play.confirm(cardName(playCard) ?? '')}
                    {play && aimed && !target && text.play.aim(cardName(playCard) ?? '')}
                    {target &&
                      text.play.loot(nameOf(target.playerId), playCard?.kind === 'catBalou')}
                    {!play && discardCount > 0 && ` ${text.play.overLimit(discardCount)}`}
                  </p>
                  {target && (
                    <div className="bang-cards">
                      {target.handCount > 0 && (
                        <button
                          type="button"
                          className="bang-loot-hand"
                          onClick={() => playOn(target.playerId, null)}
                        >
                          <CardBack />
                          <span>{text.play.lootHand}</span>
                        </button>
                      )}
                      {target.inPlay.map((card) => (
                        <CardFace
                          key={card.id}
                          card={card}
                          lit
                          onPick={() => playOn(target.playerId, card.id)}
                        />
                      ))}
                    </div>
                  )}
                  <div className="row wrap">
                    {play && !aimed && (
                      <button type="button" onClick={() => playOn(null, null)}>
                        {text.button.play(cardName(playCard) ?? '')}
                      </button>
                    )}
                    <button
                      type="button"
                      className={legal?.plays.length ? 'secondary' : undefined}
                      onClick={() =>
                        discardCount > 0
                          ? choose({ mode: 'discard', cards: [], targetId: null })
                          : sendAction({ type: 'END_TURN', discardIds: [] })
                      }
                    >
                      {discardCount > 0
                        ? text.button.endTurnDiscard(discardCount)
                        : text.button.endTurn}
                    </button>
                    {healOffer}
                  </div>
                </>
              )}

              {answering && mode === 'play' && (
                <>
                  <p className="bang-say">
                    {prompt === 'BANG' &&
                      text.ask.bang(
                        pending?.sourceId ? nameOf(pending.sourceId) : text.ask.someone,
                        pending?.missedNeeded ?? 1,
                      )}
                    {prompt === 'INDIANS' && text.ask.indians}
                    {prompt === 'DUEL' &&
                      text.ask.duel(
                        pending?.sourceId ? nameOf(pending.sourceId) : text.ask.someone,
                      )}
                  </p>
                  <div className="row wrap">
                    <button
                      type="button"
                      disabled={response === null}
                      onClick={() => sendAction({ type: 'RESPOND', cardId: response })}
                    >
                      {text.button.respond(cardName(hand.find((card) => card.id === response)))}
                    </button>
                    {passButton}
                    {healOffer}
                  </div>
                </>
              )}

              {prompt === 'DYING' && mode === 'play' && (
                <>
                  <p className="bang-say">{text.ask.dying}</p>
                  <div className="row wrap">
                    {healOffer}
                    {passButton}
                  </div>
                </>
              )}

              {choosing && (
                <>
                  <p className="bang-say">
                    {prompt === 'STORE' ? text.offer.storeYours : text.offer.kitYours}
                  </p>
                  <div className="row">
                    <button
                      type="button"
                      disabled={picked.length !== legal?.pickCount}
                      onClick={() => sendAction({ type: 'PICK_CARDS', cardIds: picked })}
                    >
                      {prompt === 'KIT'
                        ? text.offer.takeTwo
                        : text.offer.take(cardName(offered.find((card) => card.id === only)))}
                    </button>
                  </div>
                </>
              )}

              {prompt === 'DRAW' && (
                <>
                  <p className="bang-say">{text.draw.choose(targets.length > 0)}</p>
                  <div className="row wrap">
                    <button
                      type="button"
                      onClick={() => sendAction({ type: 'DRAW', source: 'deck', targetId: null })}
                    >
                      {text.draw.deck}
                    </button>
                    {legal?.drawFromDiscard && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          sendAction({ type: 'DRAW', source: 'discard', targetId: null })
                        }
                      >
                        {text.draw.discard(cardName(view.discardTop))}
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {me && (
            <section className="card bang-hand" aria-label={text.hand.title}>
              <h2>
                {text.hand.title}{' '}
                <span className={discardCount > 0 ? 'bang-hand-count over' : 'bang-hand-count'}>
                  {text.hand.count(hand.length, self?.alive ? self.life : null)}
                </span>
              </h2>
              {hand.length === 0 ? (
                <span className="muted">{text.hand.empty}</span>
              ) : (
                <div className="bang-cards">
                  {hand.map((card) => {
                    // Cards to give up may be any; a card to play or to answer with is one the
                    // engine lists.
                    const free = prompt !== null && mode !== 'play';
                    const listed =
                      prompt === 'PLAY'
                        ? legal?.plays.some((option) => option.cardId === card.id) === true
                        : answering && legal?.responses.includes(card.id) === true;
                    const judged = mode === 'play' && (prompt === 'PLAY' || answering);
                    return (
                      <CardFace
                        key={card.id}
                        card={card}
                        selected={picked.includes(card.id)}
                        lit={free || (judged && listed)}
                        dimmed={judged && !listed}
                        onPick={free || (judged && listed) ? () => pickCard(card.id) : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="bang-side">
          {me && self && (
            <section className="card" aria-label={text.you.title}>
              <h2>{text.you.title}</h2>
              <div className="bang-identity">
                <span className={`bang-role ${me.role}`}>
                  <Icon name={me.role} />
                </span>
                <div>
                  <span className="muted hint">{text.you.role}</span>
                  <strong>{text.role[me.role]}</strong>
                  <span>{text.roleGoal[me.role]}</span>
                </div>
              </div>
              <div className="bang-identity">
                <span className="bang-portrait">
                  <Icon name={self.character} />
                </span>
                <div>
                  <span className="muted hint">{text.you.character}</span>
                  <strong>{CHARACTER_NAME[self.character]}</strong>
                  <span>{text.characterHint[self.character]}</span>
                </div>
              </div>
            </section>
          )}
          <section className="card" aria-label={text.cast.title}>
            <h2>{text.cast.title}</h2>
            <ul className="bang-cast">
              {cast.map((role) => (
                <li key={role}>
                  <span className={`bang-role ${role}`}>
                    <Icon name={role} />
                  </span>
                  <span>{text.role[role]}</span>
                  <span className="num">×{view.roleCounts[role]}</span>
                </li>
              ))}
            </ul>
            <span className="muted hint">{text.cast.hint}</span>
          </section>
          <EventLog log={view.log} nameOf={nameOf} />
        </aside>
      </div>
    </div>
  );
}
