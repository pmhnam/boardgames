import {
  ROLE_IDS,
  type BangAction,
  type BangView,
  type CardView,
  type PendingView,
} from '@bgp/game-bang';
import { useEffect, useState, type ReactNode } from 'react';
import { playerName, type GameViewProps } from '../types';
import { CardFace } from './components/CardFace';
import { EventLog } from './components/EventLog';
import { PlayerBoard, type PlayerTile } from './components/PlayerBoard';
import {
  CARD_LABEL,
  CHARACTER_HINT,
  CHARACTER_LABEL,
  ROLE_GOAL,
  ROLE_LABEL,
  WINNER_LABEL,
} from './labels';

type NameOf = (playerId: string) => string;

/** What everyone not being asked is told the table is waiting for. */
function describeWaiting(view: BangView, nameOf: NameOf): string {
  const pending = view.pending;
  if (!pending) return `Đang chờ ${nameOf(view.turn.playerId)} đi.`;
  const who = nameOf(pending.playerId);
  const source = pending.sourceId ? nameOf(pending.sourceId) : null;
  switch (pending.type) {
    case 'BANG':
      return `${source} bắn ${who}. Đang chờ ${who} đáp trả.`;
    case 'INDIANS':
      return `Thổ dân tấn công. Đang chờ ${who} bỏ một lá BANG!.`;
    case 'DUEL':
      return `Đấu súng giữa ${who} và ${source}. Đang chờ ${who}.`;
    case 'STORE':
      return `Tiệm tạp hóa: đang chờ ${who} chọn một lá.`;
    case 'DYING':
      return `${who} đang hấp hối.`;
    default:
      return `Đang chờ ${who} rút bài.`;
  }
}

/** What the viewer is asked when a card of someone else's needs an answer from them. */
function describeAsk(pending: PendingView | null, nameOf: NameOf): string {
  const source = pending?.sourceId ? nameOf(pending.sourceId) : 'Ai đó';
  switch (pending?.type) {
    case 'BANG':
      return pending.missedNeeded > 1
        ? `${source} bắn bạn. Cần ${pending.missedNeeded} lá Trượt! để né, không thì mất 1 máu.`
        : `${source} bắn bạn. Đánh một lá Trượt! để né, không thì mất 1 máu.`;
    case 'INDIANS':
      return 'Thổ dân tấn công! Bỏ một lá BANG!, không thì mất 1 máu.';
    case 'DUEL':
      return `Đấu súng với ${source}: bỏ một lá BANG!, không thì mất 1 máu.`;
    case 'DYING':
      return 'Bạn đã hết máu. Bỏ hai lá để giữ mạng, hoặc chấp nhận bị loại.';
    default:
      return '';
  }
}

export function BangGameView({
  message,
  players,
  sendAction,
  disabled,
}: GameViewProps<BangView, BangAction>) {
  const view = message.state;
  const me = view.me;
  const legal = me?.legal;
  const prompt = disabled ? null : (legal?.prompt ?? null);
  const pending = view.pending;
  const over = view.phase === 'FINISHED';
  const nameOf: NameOf = (playerId) => playerName(players, playerId);

  // Local UI state only: what is picked but not yet sent.
  const [picked, setPicked] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  /** For a Panic! or a Cat Balou: the card on the table to take, or null for one from the hand. */
  const [loot, setLoot] = useState<string | null | undefined>(undefined);
  // One player is asked at a time, so the version only moves under a pick when it is stale.
  useEffect(() => {
    setPicked([]);
    setTargetId(null);
    setLoot(undefined);
  }, [message.version]);

  const hand = me?.hand ?? [];
  const answering = prompt === 'BANG' || prompt === 'INDIANS' || prompt === 'DUEL';
  const choosing = prompt === 'STORE' || prompt === 'KIT';
  const discardCount = prompt === 'PLAY' ? (legal?.discardCount ?? 0) : 0;
  const canHeal = legal?.canHeal === true && prompt !== null;

  // On their turn a player picks one card to play, or as many as ending the turn would have
  // them discard; Sid Ketchum may always pick the two that buy a life point.
  const pickLimit = choosing ? (legal?.pickCount ?? 1) : Math.max(1, discardCount, canHeal ? 2 : 0);
  const pickCard = (cardId: string) => {
    setPicked((current) =>
      current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : [...current, cardId].slice(-pickLimit),
    );
    setTargetId(null);
    setLoot(undefined);
  };
  const pickTarget = (playerId: string) => {
    setTargetId((current) => (current === playerId ? null : playerId));
    setLoot(undefined);
  };

  const [only] = picked.length === 1 ? picked : [];
  const play =
    prompt === 'PLAY' ? legal?.plays.find((option) => option.cardId === only) : undefined;
  const playCard = hand.find((card) => card.id === play?.cardId);
  const target = view.players.find((player) => player.playerId === targetId);

  // A Panic! or a Cat Balou takes a named card off the table, or one unseen from the hand.
  const takes = playCard?.kind === 'panic' || playCard?.kind === 'catBalou';
  const lootOptions: Array<string | null> =
    takes && target
      ? [...(target.handCount > 0 ? [null] : []), ...target.inPlay.map((card) => card.id)]
      : [];
  const chosenLoot = lootOptions.length === 1 ? lootOptions[0] : loot;
  const aimed = play !== undefined && play.targets !== null;
  const canPlay =
    play !== undefined &&
    (!aimed || (target !== undefined && (!takes || chosenLoot !== undefined)));

  const targets =
    prompt === 'DRAW' ? (legal?.drawFromPlayers ?? []) : aimed ? (play?.targets ?? []) : [];
  const response = answering && only !== undefined && legal?.responses.includes(only) ? only : null;
  const healReady = canHeal && picked.length === 2;

  const tiles: PlayerTile[] = view.players.map((player) => {
    const { playerId } = player;
    const marks: ReactNode[] = [];
    const mark = (key: string, text: string) => marks.push(<span key={key}>{text}</span>);
    if (!over && view.turn.playerId === playerId) mark('turn', 'Đang trong lượt');
    if (pending?.playerId === playerId && pending.type !== 'DRAW' && pending.type !== 'KIT') {
      mark('asked', 'Đang được hỏi');
    }
    if (pending?.waitingIds.includes(playerId)) mark('queued', 'Sắp tới lượt đáp');
    if (over && view.winnerPlayerIds.includes(playerId)) mark('winner', '🏆 Thắng');
    return {
      player,
      name: nameOf(playerId),
      isYou: playerId === me?.playerId,
      marks,
      selectable: targets.includes(playerId),
      selected: targetId === playerId,
    };
  });

  const offered = pending?.cards ?? [];
  const self = view.players.find((player) => player.playerId === me?.playerId);
  const cast = ROLE_IDS.filter((role) => view.roleCounts[role] > 0);
  const lootLabel = (cardId: string | null, cards: CardView[]) => {
    const card = cards.find((each) => each.id === cardId);
    return card ? CARD_LABEL[card.kind] : 'Một lá trên tay (không nhìn)';
  };

  return (
    <div className="stack bang">
      <header className="card bang-banner">
        <strong>
          {over && view.winner
            ? WINNER_LABEL[view.winner]
            : `Lượt ${view.turn.number} · ${nameOf(view.turn.playerId)}`}
        </strong>
        <span className="muted">
          Chồng bài: {view.deckCount} · Bài bỏ: {view.discardCount}
          {view.discardTop && ` (trên cùng: ${CARD_LABEL[view.discardTop.kind]})`}
        </span>
      </header>

      <div className="bang-table">
        <div className="stack">
          <section className="card" aria-label="Bàn chơi">
            <PlayerBoard tiles={tiles} onPick={pickTarget} />

            {offered.length > 0 && (
              <div className="stack-small">
                <span className="muted hint">
                  {pending?.type === 'STORE' ? 'Tiệm tạp hóa đang bày:' : 'Ba lá bạn đang xem:'}
                </span>
                <div className="bang-cards">
                  {offered.map((card) => (
                    <CardFace
                      key={card.id}
                      card={card}
                      selected={picked.includes(card.id)}
                      onPick={choosing ? () => pickCard(card.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {!over && (
              <div className="stack-small bang-action">
                {prompt === null && (
                  <span className="muted">
                    {me ? describeWaiting(view, nameOf) : 'Bạn đang xem ván này.'}
                  </span>
                )}

                {prompt === 'PLAY' && (
                  <>
                    <span>
                      {!play && 'Chọn một lá để đánh, hoặc kết thúc lượt.'}
                      {play && !aimed && `Đánh ${playCard ? CARD_LABEL[playCard.kind] : ''}?`}
                      {play && aimed && !target && 'Chọn người để đánh lá này vào.'}
                      {play && aimed && target && takes && chosenLoot === undefined
                        ? 'Chọn lá muốn lấy.'
                        : ''}
                      {discardCount > 0 &&
                        ` Bạn đang cầm quá giới hạn: muốn kết thúc lượt phải chọn ${discardCount} lá để bỏ.`}
                    </span>
                    {lootOptions.length > 1 && target && (
                      <div className="row wrap">
                        {lootOptions.map((cardId) => (
                          <button
                            key={cardId ?? 'hand'}
                            type="button"
                            className="secondary"
                            aria-pressed={chosenLoot === cardId}
                            onClick={() => setLoot(cardId)}
                          >
                            {lootLabel(cardId, target.inPlay)}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="row wrap">
                      <button
                        type="button"
                        disabled={!canPlay}
                        onClick={() =>
                          play &&
                          sendAction({
                            type: 'PLAY_CARD',
                            cardId: play.cardId,
                            targetId: aimed ? targetId : null,
                            targetCardId: takes ? (chosenLoot ?? null) : null,
                          })
                        }
                      >
                        {playCard ? `Đánh ${CARD_LABEL[playCard.kind]}` : 'Đánh'}
                        {aimed && target ? ` vào ${nameOf(target.playerId)}` : ''}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={discardCount > 0 && picked.length !== discardCount}
                        onClick={() =>
                          sendAction({
                            type: 'END_TURN',
                            discardIds: discardCount > 0 ? picked : [],
                          })
                        }
                      >
                        {discardCount > 0
                          ? `Bỏ ${discardCount} lá và kết thúc lượt`
                          : 'Kết thúc lượt'}
                      </button>
                    </div>
                  </>
                )}

                {(answering || prompt === 'DYING') && (
                  <>
                    <span>{describeAsk(pending, nameOf)}</span>
                    <div className="row wrap">
                      {answering && (
                        <button
                          type="button"
                          disabled={response === null}
                          onClick={() => sendAction({ type: 'RESPOND', cardId: response })}
                        >
                          Đáp trả
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => sendAction({ type: 'RESPOND', cardId: null })}
                      >
                        {prompt === 'DYING' ? 'Chấp nhận bị loại' : 'Chịu mất 1 máu'}
                      </button>
                    </div>
                  </>
                )}

                {choosing && (
                  <>
                    <span>
                      {prompt === 'STORE'
                        ? 'Tới lượt bạn chọn một lá ở Tiệm tạp hóa.'
                        : 'Chọn hai lá để giữ; lá còn lại quay về chồng bài.'}
                    </span>
                    <div className="row">
                      <button
                        type="button"
                        disabled={picked.length !== legal?.pickCount}
                        onClick={() => sendAction({ type: 'PICK_CARDS', cardIds: picked })}
                      >
                        Lấy
                      </button>
                    </div>
                  </>
                )}

                {prompt === 'DRAW' && (
                  <>
                    <span>
                      Chọn nơi rút lá đầu tiên của lượt
                      {targets.length > 0 && ': chồng bài, hoặc tay của một người'}.
                    </span>
                    <div className="row wrap">
                      <button
                        type="button"
                        onClick={() => sendAction({ type: 'DRAW', source: 'deck', targetId: null })}
                      >
                        Rút 2 lá từ chồng bài
                      </button>
                      {legal?.drawFromDiscard && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            sendAction({ type: 'DRAW', source: 'discard', targetId: null })
                          }
                        >
                          Lấy {view.discardTop ? CARD_LABEL[view.discardTop.kind] : 'lá trên cùng'}{' '}
                          từ chồng bài bỏ
                        </button>
                      )}
                      {targets.length > 0 && (
                        <button
                          type="button"
                          className="secondary"
                          disabled={!target}
                          onClick={() =>
                            target &&
                            sendAction({
                              type: 'DRAW',
                              source: 'player',
                              targetId: target.playerId,
                            })
                          }
                        >
                          {target
                            ? `Rút từ tay ${nameOf(target.playerId)}`
                            : 'Rút từ tay một người'}
                        </button>
                      )}
                    </div>
                  </>
                )}

                {canHeal && (
                  <div className="row wrap">
                    <button
                      type="button"
                      className="secondary"
                      disabled={!healReady}
                      onClick={() => sendAction({ type: 'DISCARD_TO_HEAL', cardIds: picked })}
                    >
                      Bỏ hai lá đã chọn để hồi 1 máu
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {me && (
            <section className="card" aria-label="Bài trên tay">
              <h2>
                Bài trên tay{' '}
                <span className="muted">
                  ({hand.length}
                  {self?.alive ? `, giữ được ${self.life} khi hết lượt` : ''})
                </span>
              </h2>
              {hand.length === 0 ? (
                <span className="muted">Bạn không cầm lá nào.</span>
              ) : (
                <div className="bang-cards">
                  {hand.map((card) => {
                    const playable = legal?.plays.some((option) => option.cardId === card.id);
                    const answers = legal?.responses.includes(card.id);
                    const pickable =
                      prompt === 'PLAY' ||
                      (answering && (answers || canHeal)) ||
                      prompt === 'DYING';
                    return (
                      <CardFace
                        key={card.id}
                        card={card}
                        selected={picked.includes(card.id)}
                        dimmed={(prompt === 'PLAY' && !playable) || (answering && !answers)}
                        onPick={pickable ? () => pickCard(card.id) : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="stack bang-side">
          {me && self && (
            <section className="card" aria-label="Vai của bạn">
              <h2>Vai của bạn</h2>
              <div className="stack-small">
                <strong>{ROLE_LABEL[me.role]}</strong>
                <span className="muted">{ROLE_GOAL[me.role]}</span>
                <strong>{CHARACTER_LABEL[self.character]}</strong>
                <span className="muted">{CHARACTER_HINT[self.character]}</span>
              </div>
            </section>
          )}
          <section className="card" aria-label="Các vai">
            <h2>Các vai trong ván</h2>
            <ul className="bang-cast">
              {cast.map((role) => (
                <li key={role}>
                  <span>{ROLE_LABEL[role]}</span>
                  <span className="num">×{view.roleCounts[role]}</span>
                </li>
              ))}
            </ul>
            <span className="muted hint">Vai được lật khi người chơi bị loại.</span>
          </section>
          <EventLog log={view.log} nameOf={nameOf} />
        </aside>
      </div>
    </div>
  );
}
