import type { CardView, LogEntryView } from '@bgp/game-bang';
import { CARD_LABEL, ROLE_LABEL, pipLabel } from '../labels';

type NameOf = (playerId: string) => string;

const CHECK_LABEL = { barrel: 'Thùng gỗ', jail: 'Nhà tù', dynamite: 'Thuốc nổ' } as const;
const CHECK_RESULT = {
  barrel: { passed: 'né được', failed: 'không né được' },
  jail: { passed: 'thoát tù', failed: 'mất lượt' },
  dynamite: { passed: 'chưa nổ', failed: 'NỔ!' },
} as const;

function cardNames(cards: CardView[]): string {
  return cards.map((card) => CARD_LABEL[card.kind]).join(', ');
}

function describe(entry: LogEntryView, nameOf: NameOf): string {
  const who = nameOf(entry.playerId);
  switch (entry.type) {
    case 'TURN':
      return `Lượt của ${who}`;
    case 'PLAY':
      return entry.targetId
        ? `${who} đánh ${CARD_LABEL[entry.card.kind]} vào ${nameOf(entry.targetId)}.`
        : `${who} đánh ${CARD_LABEL[entry.card.kind]}.`;
    case 'RESPONSE':
      return `${who} đáp trả bằng ${CARD_LABEL[entry.card.kind]}.`;
    case 'CHECK': {
      const result = CHECK_RESULT[entry.reason][entry.passed ? 'passed' : 'failed'];
      const flipped = entry.cards.map(pipLabel).join(', ') || 'hết bài';
      return `${who} lật bài cho ${CHECK_LABEL[entry.reason]} (${flipped}): ${result}.`;
    }
    case 'HIT':
      return entry.sourceId
        ? `${who} mất ${entry.amount} máu vì ${nameOf(entry.sourceId)}.`
        : `${who} mất ${entry.amount} máu.`;
    case 'DRAW':
      if (entry.from === 'discard') {
        return `${who} lấy ${entry.shown ? CARD_LABEL[entry.shown.kind] : 'một lá'} từ chồng bài bỏ.`;
      }
      return entry.shown
        ? `${who} rút ${entry.count} lá, lật ra ${CARD_LABEL[entry.shown.kind]} ${pipLabel(entry.shown)}.`
        : `${who} rút ${entry.count} lá.`;
    case 'TAKE': {
      const what = entry.card
        ? CARD_LABEL[entry.card.kind]
        : entry.fromHand
          ? 'một lá trên tay'
          : 'một lá';
      const verb = entry.discarded ? 'bỏ' : 'lấy';
      return `${who} ${verb} ${what} của ${nameOf(entry.fromId)}.`;
    }
    case 'PICK':
      return `${who} lấy ${CARD_LABEL[entry.card.kind]} ở Tiệm tạp hóa.`;
    case 'DISCARD':
      if (entry.reason === 'penalty') return `${who} mất hết bài vì hạ Phó cảnh sát.`;
      return entry.reason === 'heal'
        ? `${who} bỏ ${cardNames(entry.cards)} để hồi 1 máu.`
        : `${who} bỏ ${cardNames(entry.cards)}.`;
    case 'DEATH': {
      const by = entry.killerId ? ` bởi ${nameOf(entry.killerId)}` : '';
      const loot = entry.lootedById ? ` ${nameOf(entry.lootedById)} lấy hết bài.` : '';
      return `${who} bị loại${by}: là ${ROLE_LABEL[entry.role]}.${loot}`;
    }
  }
}

/** What the table has seen happen, newest first. */
export function EventLog({ log, nameOf }: { log: LogEntryView[]; nameOf: NameOf }) {
  return (
    <section className="card" aria-label="Nhật ký">
      <h2>Nhật ký</h2>
      {log.length === 0 ? (
        <span className="muted">Chưa có gì xảy ra.</span>
      ) : (
        <ol className="bang-log">
          {[...log].reverse().map((entry) => (
            <li
              key={entry.id}
              className={
                entry.type === 'TURN' ? 'turn' : entry.type === 'DEATH' ? 'death' : undefined
              }
            >
              {describe(entry, nameOf)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
