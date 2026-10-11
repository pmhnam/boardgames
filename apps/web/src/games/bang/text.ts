import type {
  CardKind,
  CardView,
  CharacterId,
  CheckReason,
  LogEntryView,
  RoleId,
  Winner,
} from '@bgp/game-bang';
import type { Locale } from '../../shared/i18n/locales';
import { pipLabel } from './pips';

export type NameOf = (playerId: string) => string;

/** The characters are named the same in every language. */
export const CHARACTER_NAME: Record<CharacterId, string> = {
  bartCassidy: 'Bart Cassidy',
  blackJack: 'Black Jack',
  calamityJanet: 'Calamity Janet',
  elGringo: 'El Gringo',
  jesseJones: 'Jesse Jones',
  jourdonnais: 'Jourdonnais',
  kitCarlson: 'Kit Carlson',
  luckyDuke: 'Lucky Duke',
  paulRegret: 'Paul Regret',
  pedroRamirez: 'Pedro Ramirez',
  roseDoolan: 'Rose Doolan',
  sidKetchum: 'Sid Ketchum',
  slabTheKiller: 'Slab the Killer',
  suzyLafayette: 'Suzy Lafayette',
  vultureSam: 'Vulture Sam',
  willyTheKid: 'Willy the Kid',
};

/** Everything the BANG! table says, one set per language of `shared/i18n/locales.ts`. */
export interface BangText {
  alerts: { title: string; body: string };

  card: Record<CardKind, string>;
  cardHint: Record<CardKind, string>;
  /** What a card's border says about it. */
  cardColor: { brown: string; blue: string; weapon(range: number): string };
  /** A card seen from behind. */
  cardBack: string;
  characterHint: Record<CharacterId, string>;
  role: Record<RoleId, string>;
  roleGoal: Record<RoleId, string>;
  hiddenRole: string;
  hiddenRoleHint: string;
  winner: Record<Winner, string>;

  banner: {
    yourTurn: string;
    turnOf(name: string): string;
    turnNumber(turn: number): string;
    watching: string;
  };
  /** The three things a turn is made of, in order. */
  steps: [draw: string, play: string, discard: string];
  stepsLabel: string;
  tools: {
    label: string;
    soundOn: string;
    soundOff: string;
    notifyOn: string;
    notifyOff: string;
    notifyRequesting: string;
    notifyHint: string;
    notifyUnsupported: string;
    notifyDenied: string;
  };

  table: {
    label: string;
    deck(count: number): string;
    discard(count: number): string;
    discardEmpty: string;
    quiet: string;
  };
  seat: {
    you: string;
    eliminated: string;
    life(life: number, max: number): string;
    hand(count: number): string;
    range(range: number): string;
    distance(distance: number): string;
    inPlay: string;
    turn: string;
    asked: string;
    queued: string;
    winner: string;
    hit(amount: number): string;
    answered: string;
    blast: string;
    dead: string;
  };

  waiting: {
    turn(name: string): string;
    bang(source: string, who: string): string;
    indians(who: string): string;
    duel(who: string, source: string): string;
    store(who: string): string;
    dying(who: string): string;
    draw(who: string): string;
  };
  ask: {
    bang(source: string, missedNeeded: number): string;
    indians: string;
    duel(source: string): string;
    dying: string;
    someone: string;
  };
  play: {
    choose: string;
    nothing: string;
    confirm(card: string): string;
    aim(card: string): string;
    loot(name: string, discards: boolean): string;
    lootHand: string;
    overLimit(count: number): string;
  };
  discard: { choose(count: number, picked: number): string };
  heal: { offer: string; choose(picked: number): string; confirm: string };
  offer: {
    storeLabel: string;
    storeYours: string;
    kitLabel: string;
    kitYours: string;
    take(card: string | null): string;
    takeTwo: string;
  };
  draw: {
    choose(fromPlayers: boolean): string;
    deck: string;
    discard(card: string | null): string;
  };
  button: {
    play(card: string): string;
    endTurn: string;
    endTurnDiscard(count: number): string;
    discardAndEnd(count: number): string;
    back: string;
    respond(card: string | null): string;
    takeHit: string;
    giveUp: string;
  };

  hand: {
    title: string;
    count(count: number, limit: number | null): string;
    empty: string;
    unplayable: string;
  };
  you: { title: string; role: string; character: string };
  cast: { title: string; hint: string };
  log: {
    title: string;
    empty: string;
    describe(entry: LogEntryView, nameOf: NameOf): string;
  };
  /** The credit the icons' licence asks for. */
  credit: string;
}

function names(cards: CardView[], label: Record<CardKind, string>): string {
  return cards.map((card) => label[card.kind]).join(', ');
}

const VI_CARD: Record<CardKind, string> = {
  bang: 'BANG!',
  missed: 'Trượt!',
  beer: 'Bia',
  saloon: 'Quán rượu',
  stagecoach: 'Xe ngựa',
  wellsFargo: 'Wells Fargo',
  generalStore: 'Tiệm tạp hóa',
  panic: 'Hoảng loạn!',
  catBalou: 'Cat Balou',
  duel: 'Đấu súng',
  gatling: 'Gatling',
  indians: 'Thổ dân!',
  barrel: 'Thùng gỗ',
  scope: 'Ống ngắm',
  mustang: 'Ngựa Mustang',
  jail: 'Nhà tù',
  dynamite: 'Thuốc nổ',
  volcanic: 'Volcanic',
  schofield: 'Schofield',
  remington: 'Remington',
  revCarabine: 'Rev. Carabine',
  winchester: 'Winchester',
};

const VI_ROLE: Record<RoleId, string> = {
  sheriff: 'Cảnh sát trưởng',
  deputy: 'Phó cảnh sát',
  outlaw: 'Tội phạm',
  renegade: 'Kẻ phản bội',
};

const VI_CHECK: Record<CheckReason, { name: string; passed: string; failed: string }> = {
  barrel: { name: 'Thùng gỗ', passed: 'né được', failed: 'không né được' },
  jail: { name: 'Nhà tù', passed: 'thoát tù', failed: 'mất lượt' },
  dynamite: { name: 'Thuốc nổ', passed: 'chưa nổ', failed: 'NỔ!' },
};

const vi: BangText = {
  alerts: { title: 'BANG!: tới bạn', body: 'Bàn đang chờ bạn.' },

  card: VI_CARD,
  cardHint: {
    bang: 'Bắn một người trong tầm. Họ mất 1 máu nếu không có Trượt!. Mỗi lượt một lá.',
    missed: 'Né một phát BANG! bắn vào bạn.',
    beer: 'Hồi 1 máu. Vô dụng khi chỉ còn hai người.',
    saloon: 'Mọi người còn sống hồi 1 máu.',
    stagecoach: 'Rút 2 lá.',
    wellsFargo: 'Rút 3 lá.',
    generalStore: 'Lật số lá bằng số người còn sống; lần lượt mỗi người lấy một lá.',
    panic: 'Lấy một lá của người cách bạn 1.',
    catBalou: 'Bắt một người bất kỳ bỏ một lá.',
    duel: 'Hai người thay nhau bỏ BANG!, bắt đầu từ người bị thách. Ai không bỏ được mất 1 máu.',
    gatling: 'Bắn BANG! vào tất cả những người khác.',
    indians: 'Mỗi người khác bỏ một lá BANG! hoặc mất 1 máu.',
    barrel: 'Khi bị bắn, lật một lá: ra cơ thì né được.',
    scope: 'Bạn nhìn mọi người gần hơn 1.',
    mustang: 'Mọi người nhìn bạn xa hơn 1.',
    jail: 'Đặt lên người khác (trừ Cảnh sát trưởng). Đầu lượt họ lật một lá: không ra cơ thì mất lượt.',
    dynamite: 'Đầu lượt lật một lá: bích 2–9 thì nổ, mất 3 máu; không thì chuyển cho người kế.',
    volcanic: 'Được đánh bao nhiêu lá BANG! cũng được.',
    schofield: 'Bắn tới người cách bạn 2.',
    remington: 'Bắn tới người cách bạn 3.',
    revCarabine: 'Bắn tới người cách bạn 4.',
    winchester: 'Bắn tới người cách bạn 5.',
  },
  cardColor: {
    brown: 'Viền nâu: đánh xong thì bỏ.',
    blue: 'Viền xanh: nằm lại trên bàn trước mặt người chơi.',
    weapon: (range) => `Súng tầm ${range}: mỗi người chỉ giữ một khẩu.`,
  },
  cardBack: 'Lá bài úp',
  characterHint: {
    bartCassidy: 'Mỗi máu mất đi, rút một lá.',
    blackJack: 'Lật lá thứ hai khi rút bài: ra cơ hoặc rô thì rút thêm một lá.',
    calamityJanet: 'Dùng BANG! như Trượt! và Trượt! như BANG!.',
    elGringo: 'Mỗi máu bị người khác lấy đi, rút một lá từ tay người đó.',
    jesseJones: 'Lá đầu tiên trong lượt có thể rút từ tay người khác.',
    jourdonnais: 'Luôn có sẵn một Thùng gỗ.',
    kitCarlson: 'Xem ba lá trên cùng chồng bài, giữ hai lá.',
    luckyDuke: 'Mỗi lần phải lật bài thì lật hai lá và chọn lá tốt hơn.',
    paulRegret: 'Mọi người nhìn bạn xa hơn 1.',
    pedroRamirez: 'Lá đầu tiên trong lượt có thể lấy từ chồng bài bỏ.',
    roseDoolan: 'Bạn nhìn mọi người gần hơn 1.',
    sidKetchum: 'Bỏ hai lá để hồi 1 máu.',
    slabTheKiller: 'BANG! của bạn cần hai lá Trượt! mới né được.',
    suzyLafayette: 'Hết bài trên tay thì rút ngay một lá.',
    vultureSam: 'Lấy toàn bộ bài của người bị loại.',
    willyTheKid: 'Được đánh bao nhiêu lá BANG! cũng được.',
  },
  role: VI_ROLE,
  roleGoal: {
    sheriff: 'Loại hết Tội phạm và Kẻ phản bội.',
    deputy: 'Bảo vệ Cảnh sát trưởng: loại hết Tội phạm và Kẻ phản bội.',
    outlaw: 'Hạ Cảnh sát trưởng.',
    renegade: 'Là người cuối cùng sống sót: hạ Cảnh sát trưởng sau cùng.',
  },
  hiddenRole: 'Vai ẩn',
  hiddenRoleHint: 'Vai chỉ được lật khi người này bị loại.',
  winner: {
    law: 'Phe luật pháp thắng',
    outlaws: 'Tội phạm thắng',
    renegade: 'Kẻ phản bội thắng',
  },

  banner: {
    yourTurn: 'Lượt của bạn',
    turnOf: (name) => `Lượt của ${name}`,
    turnNumber: (turn) => `Lượt ${turn}`,
    watching: 'Bạn đang xem ván này.',
  },
  steps: ['Rút bài', 'Đánh bài', 'Bỏ bài thừa'],
  stepsLabel: 'Các bước của lượt',
  tools: {
    label: 'Tùy chọn',
    soundOn: 'Âm báo: bật',
    soundOff: 'Âm báo: tắt',
    notifyOn: 'Bật thông báo',
    notifyOff: 'Tắt thông báo',
    notifyRequesting: 'Đang xin quyền…',
    notifyHint: 'Báo khi bàn chờ bạn mà bạn đang ở thẻ khác.',
    notifyUnsupported: 'Trình duyệt này không hỗ trợ thông báo.',
    notifyDenied: 'Thông báo đang bị chặn trong cài đặt trình duyệt.',
  },

  table: {
    label: 'Bàn chơi',
    deck: (count) => `Chồng bài: ${count} lá`,
    discard: (count) => `Bài bỏ: ${count} lá`,
    discardEmpty: 'Chưa có bài bỏ',
    quiet: 'Chưa có gì xảy ra.',
  },
  seat: {
    you: 'bạn',
    eliminated: 'Đã bị loại',
    life: (life, max) => `Máu ${life}/${max}`,
    hand: (count) => `${count} lá trên tay`,
    range: (range) => `Tầm bắn ${range}: BANG! tới được người cách tối đa ${range}.`,
    distance: (distance) => `Cách bạn ${distance}.`,
    inPlay: 'Bài trên bàn',
    turn: 'Đang trong lượt',
    asked: 'Đang được hỏi',
    queued: 'Sắp tới lượt đáp',
    winner: 'Thắng',
    hit: (amount) => `−${amount}`,
    answered: 'Né!',
    blast: 'BÙM!',
    dead: 'Hạ gục',
  },

  waiting: {
    turn: (name) => `Đang chờ ${name} đi.`,
    bang: (source, who) => `${source} bắn ${who}. Đang chờ ${who} đáp trả.`,
    indians: (who) => `Thổ dân tấn công. Đang chờ ${who} bỏ một lá BANG!.`,
    duel: (who, source) => `Đấu súng giữa ${who} và ${source}. Đang chờ ${who}.`,
    store: (who) => `Tiệm tạp hóa: đang chờ ${who} chọn một lá.`,
    dying: (who) => `${who} đang hấp hối.`,
    draw: (who) => `Đang chờ ${who} rút bài.`,
  },
  ask: {
    bang: (source, missedNeeded) =>
      missedNeeded > 1
        ? `${source} bắn bạn. Cần ${missedNeeded} lá Trượt! để né, không thì mất 1 máu.`
        : `${source} bắn bạn. Đánh một lá Trượt! để né, không thì mất 1 máu.`,
    indians: 'Thổ dân tấn công! Bỏ một lá BANG!, không thì mất 1 máu.',
    duel: (source) => `Đấu súng với ${source}: bỏ một lá BANG!, không thì mất 1 máu.`,
    dying: 'Bạn đã hết máu. Bỏ hai lá để giữ mạng, hoặc chấp nhận bị loại.',
    someone: 'Ai đó',
  },
  play: {
    choose: 'Chọn một lá đang sáng để đánh, hoặc kết thúc lượt.',
    nothing: 'Không còn lá nào đánh được. Hãy kết thúc lượt.',
    confirm: (card) => `Đánh ${card}?`,
    aim: (card) => `Chọn một người đang sáng trên bàn để đánh ${card} vào.`,
    loot: (name, discards) =>
      discards ? `Chọn lá ${name} phải bỏ.` : `Chọn lá muốn lấy của ${name}.`,
    lootHand: 'Một lá trên tay (không nhìn)',
    overLimit: (count) => `Bạn cầm quá giới hạn: kết thúc lượt sẽ phải bỏ ${count} lá.`,
  },
  discard: {
    choose: (count, picked) => `Chọn ${count} lá để bỏ (${picked}/${count}).`,
  },
  heal: {
    offer: 'Bỏ hai lá để hồi 1 máu',
    choose: (picked) => `Chọn hai lá để bỏ, đổi lấy 1 máu (${picked}/2).`,
    confirm: 'Bỏ hai lá, hồi 1 máu',
  },
  offer: {
    storeLabel: 'Tiệm tạp hóa đang bày:',
    storeYours: 'Tới lượt bạn chọn một lá ở Tiệm tạp hóa.',
    kitLabel: 'Ba lá bạn đang xem:',
    kitYours: 'Chọn hai lá để giữ; lá còn lại quay về chồng bài.',
    take: (card) => (card ? `Lấy ${card}` : 'Lấy'),
    takeTwo: 'Giữ hai lá đã chọn',
  },
  draw: {
    choose: (fromPlayers) =>
      fromPlayers
        ? 'Chọn nơi rút lá đầu tiên: chồng bài, hoặc bấm vào một người đang sáng để rút từ tay họ.'
        : 'Chọn nơi rút lá đầu tiên của lượt.',
    deck: 'Rút 2 lá từ chồng bài',
    discard: (card) => `Lấy ${card ?? 'lá trên cùng'} từ chồng bài bỏ`,
  },
  button: {
    play: (card) => `Đánh ${card}`,
    endTurn: 'Kết thúc lượt',
    endTurnDiscard: (count) => `Kết thúc lượt (bỏ ${count} lá)`,
    discardAndEnd: (count) => `Bỏ ${count} lá và kết thúc lượt`,
    back: 'Quay lại',
    respond: (card) => (card ? `Đáp trả bằng ${card}` : 'Đáp trả'),
    takeHit: 'Chịu mất 1 máu',
    giveUp: 'Chấp nhận bị loại',
  },

  hand: {
    title: 'Bài trên tay',
    count: (count, limit) =>
      limit === null ? `${count} lá` : `${count} lá · giữ được ${limit} khi hết lượt`,
    empty: 'Bạn không cầm lá nào.',
    unplayable: 'Chưa đánh được lúc này.',
  },
  you: { title: 'Bạn là', role: 'Vai', character: 'Nhân vật' },
  cast: { title: 'Các vai trong ván', hint: 'Vai được lật khi người chơi bị loại.' },
  log: {
    title: 'Nhật ký',
    empty: 'Chưa có gì xảy ra.',
    describe(entry, nameOf) {
      const who = nameOf(entry.playerId);
      switch (entry.type) {
        case 'TURN':
          return `Lượt của ${who}`;
        case 'PLAY':
          return entry.targetId
            ? `${who} đánh ${VI_CARD[entry.card.kind]} vào ${nameOf(entry.targetId)}.`
            : `${who} đánh ${VI_CARD[entry.card.kind]}.`;
        case 'RESPONSE':
          return `${who} đáp trả bằng ${VI_CARD[entry.card.kind]}.`;
        case 'CHECK': {
          const check = VI_CHECK[entry.reason];
          const flipped = entry.cards.map(pipLabel).join(', ') || 'hết bài';
          return `${who} lật bài cho ${check.name} (${flipped}): ${entry.passed ? check.passed : check.failed}.`;
        }
        case 'HIT':
          return entry.sourceId
            ? `${who} mất ${entry.amount} máu vì ${nameOf(entry.sourceId)}.`
            : `${who} mất ${entry.amount} máu.`;
        case 'DRAW':
          if (entry.from === 'discard') {
            return `${who} lấy ${entry.shown ? VI_CARD[entry.shown.kind] : 'một lá'} từ chồng bài bỏ.`;
          }
          return entry.shown
            ? `${who} rút ${entry.count} lá, lật ra ${VI_CARD[entry.shown.kind]} ${pipLabel(entry.shown)}.`
            : `${who} rút ${entry.count} lá.`;
        case 'TAKE': {
          const what = entry.card
            ? VI_CARD[entry.card.kind]
            : entry.fromHand
              ? 'một lá trên tay'
              : 'một lá';
          return `${who} ${entry.discarded ? 'bỏ' : 'lấy'} ${what} của ${nameOf(entry.fromId)}.`;
        }
        case 'PICK':
          return `${who} lấy ${VI_CARD[entry.card.kind]} ở Tiệm tạp hóa.`;
        case 'DISCARD':
          if (entry.reason === 'penalty') return `${who} mất hết bài vì hạ Phó cảnh sát.`;
          return entry.reason === 'heal'
            ? `${who} bỏ ${names(entry.cards, VI_CARD)} để hồi 1 máu.`
            : `${who} bỏ ${names(entry.cards, VI_CARD)}.`;
        case 'DEATH': {
          const by = entry.killerId ? ` bởi ${nameOf(entry.killerId)}` : '';
          const loot = entry.lootedById ? ` ${nameOf(entry.lootedById)} lấy hết bài.` : '';
          return `${who} bị loại${by}: là ${VI_ROLE[entry.role]}.${loot}`;
        }
      }
    },
  },
  credit: 'Biểu tượng: Lorc, Delapouite, Skoll, Faithtoken, Sbed và các tác giả khác',
};

const EN_CARD: Record<CardKind, string> = {
  bang: 'BANG!',
  missed: 'Missed!',
  beer: 'Beer',
  saloon: 'Saloon',
  stagecoach: 'Stagecoach',
  wellsFargo: 'Wells Fargo',
  generalStore: 'General Store',
  panic: 'Panic!',
  catBalou: 'Cat Balou',
  duel: 'Duel',
  gatling: 'Gatling',
  indians: 'Indians!',
  barrel: 'Barrel',
  scope: 'Scope',
  mustang: 'Mustang',
  jail: 'Jail',
  dynamite: 'Dynamite',
  volcanic: 'Volcanic',
  schofield: 'Schofield',
  remington: 'Remington',
  revCarabine: 'Rev. Carabine',
  winchester: 'Winchester',
};

const EN_ROLE: Record<RoleId, string> = {
  sheriff: 'Sheriff',
  deputy: 'Deputy',
  outlaw: 'Outlaw',
  renegade: 'Renegade',
};

const EN_CHECK: Record<CheckReason, { name: string; passed: string; failed: string }> = {
  barrel: { name: 'the Barrel', passed: 'dodged', failed: 'no dodge' },
  jail: { name: 'the Jail', passed: 'out of jail', failed: 'turn lost' },
  dynamite: { name: 'the Dynamite', passed: 'no blast yet', failed: 'BOOM!' },
};

function cards(count: number): string {
  return count === 1 ? '1 card' : `${count} cards`;
}

const en: BangText = {
  alerts: { title: 'BANG!: over to you', body: 'The table is waiting for you.' },

  card: EN_CARD,
  cardHint: {
    bang: 'Shoot a player in range. They lose 1 life unless they play a Missed!. One per turn.',
    missed: 'Dodge a BANG! shot at you.',
    beer: 'Regain 1 life. No use once only two players are left.',
    saloon: 'Everyone still in regains 1 life.',
    stagecoach: 'Draw 2 cards.',
    wellsFargo: 'Draw 3 cards.',
    generalStore: 'Turn up a card for each player still in; each takes one in turn.',
    panic: 'Take a card from a player at distance 1.',
    catBalou: 'Make any player discard a card.',
    duel: 'The two of you discard a BANG! in turn, the challenged player first. Whoever cannot loses 1 life.',
    gatling: 'Shoot a BANG! at every other player.',
    indians: 'Every other player discards a BANG! or loses 1 life.',
    barrel: 'When shot at, flip a card: a heart dodges.',
    scope: 'You see everyone from 1 closer.',
    mustang: 'Everyone sees you from 1 further away.',
    jail: 'Put it on another player (not the Sheriff). At the start of their turn they flip a card: unless it is a heart they lose the turn.',
    dynamite:
      'At the start of your turn flip a card: spades 2–9 and it blows, costing 3 life; otherwise it passes to the next player.',
    volcanic: 'Play as many BANG! cards as you like.',
    schofield: 'Reaches players up to distance 2.',
    remington: 'Reaches players up to distance 3.',
    revCarabine: 'Reaches players up to distance 4.',
    winchester: 'Reaches players up to distance 5.',
  },
  cardColor: {
    brown: 'Brown border: played, then discarded.',
    blue: 'Blue border: stays on the table in front of a player.',
    weapon: (range) => `A weapon with range ${range}: a player holds one at a time.`,
  },
  cardBack: 'A card, face down',
  characterHint: {
    bartCassidy: 'Draws a card for each life point lost.',
    blackJack: 'Shows the second card drawn: a heart or a diamond earns one more.',
    calamityJanet: 'Plays BANG! as Missed! and Missed! as BANG!.',
    elGringo:
      'For each life point another player costs them, draws a card from that player’s hand.',
    jesseJones: 'May draw the first card of the turn from another player’s hand.',
    jourdonnais: 'Always has a Barrel.',
    kitCarlson: 'Looks at the top three cards of the deck and keeps two.',
    luckyDuke: 'Flips two cards whenever one is to be flipped, and takes the better.',
    paulRegret: 'Everyone sees them from 1 further away.',
    pedroRamirez: 'May take the first card of the turn from the discard pile.',
    roseDoolan: 'Sees everyone from 1 closer.',
    sidKetchum: 'May discard two cards to regain 1 life.',
    slabTheKiller: 'It takes two Missed! to dodge their BANG!.',
    suzyLafayette: 'Draws a card as soon as their hand is empty.',
    vultureSam: 'Takes all the cards of anyone eliminated.',
    willyTheKid: 'May play as many BANG! cards as they like.',
  },
  role: EN_ROLE,
  roleGoal: {
    sheriff: 'Eliminate every Outlaw and the Renegade.',
    deputy: 'Protect the Sheriff: eliminate every Outlaw and the Renegade.',
    outlaw: 'Take down the Sheriff.',
    renegade: 'Be the last one standing: take the Sheriff down last.',
  },
  hiddenRole: 'Hidden role',
  hiddenRoleHint: 'A role is only shown once its player is eliminated.',
  winner: {
    law: 'The law wins',
    outlaws: 'The Outlaws win',
    renegade: 'The Renegade wins',
  },

  banner: {
    yourTurn: 'Your turn',
    turnOf: (name) => `${name}’s turn`,
    turnNumber: (turn) => `Turn ${turn}`,
    watching: 'You are watching this match.',
  },
  steps: ['Draw', 'Play', 'Discard down'],
  stepsLabel: 'Steps of the turn',
  tools: {
    label: 'Options',
    soundOn: 'Chime: on',
    soundOff: 'Chime: off',
    notifyOn: 'Turn on notifications',
    notifyOff: 'Turn off notifications',
    notifyRequesting: 'Asking permission…',
    notifyHint: 'Tells you when the table is waiting for you and you are on another tab.',
    notifyUnsupported: 'This browser does not support notifications.',
    notifyDenied: 'Notifications are blocked in the browser’s settings.',
  },

  table: {
    label: 'The table',
    deck: (count) => `Deck: ${cards(count)}`,
    discard: (count) => `Discard pile: ${cards(count)}`,
    discardEmpty: 'Nothing discarded yet',
    quiet: 'Nothing has happened yet.',
  },
  seat: {
    you: 'you',
    eliminated: 'Eliminated',
    life: (life, max) => `Life ${life}/${max}`,
    hand: (count) => `${cards(count)} in hand`,
    range: (range) => `Range ${range}: their BANG! reaches players up to distance ${range}.`,
    distance: (distance) => `At distance ${distance} from you.`,
    inPlay: 'Cards on the table',
    turn: 'Taking their turn',
    asked: 'Being asked',
    queued: 'Up next to answer',
    winner: 'Winner',
    hit: (amount) => `−${amount}`,
    answered: 'Dodged!',
    blast: 'BOOM!',
    dead: 'Down',
  },

  waiting: {
    turn: (name) => `Waiting for ${name} to play.`,
    bang: (source, who) => `${source} shoots at ${who}. Waiting for ${who} to answer.`,
    indians: (who) => `Indians attack. Waiting for ${who} to discard a BANG!.`,
    duel: (who, source) => `A duel between ${who} and ${source}. Waiting for ${who}.`,
    store: (who) => `General Store: waiting for ${who} to take a card.`,
    dying: (who) => `${who} is dying.`,
    draw: (who) => `Waiting for ${who} to draw.`,
  },
  ask: {
    bang: (source, missedNeeded) =>
      missedNeeded > 1
        ? `${source} shoots at you. It takes ${missedNeeded} Missed! to dodge, or you lose 1 life.`
        : `${source} shoots at you. Play a Missed! to dodge, or lose 1 life.`,
    indians: 'Indians attack! Discard a BANG!, or lose 1 life.',
    duel: (source) => `A duel with ${source}: discard a BANG!, or lose 1 life.`,
    dying: 'You are out of life. Discard two cards to hold on, or accept being eliminated.',
    someone: 'Someone',
  },
  play: {
    choose: 'Pick a lit card to play, or end your turn.',
    nothing: 'Nothing left to play. End your turn.',
    confirm: (card) => `Play ${card}?`,
    aim: (card) => `Pick a lit player at the table to play ${card} on.`,
    loot: (name, discards) =>
      discards ? `Pick the card ${name} must discard.` : `Pick the card to take from ${name}.`,
    lootHand: 'A card from their hand (unseen)',
    overLimit: (count) => `You hold too many: ending the turn means discarding ${cards(count)}.`,
  },
  discard: {
    choose: (count, picked) => `Pick ${cards(count)} to discard (${picked}/${count}).`,
  },
  heal: {
    offer: 'Discard two cards for 1 life',
    choose: (picked) => `Pick two cards to discard for 1 life (${picked}/2).`,
    confirm: 'Discard both, regain 1 life',
  },
  offer: {
    storeLabel: 'On offer at the General Store:',
    storeYours: 'Your pick at the General Store.',
    kitLabel: 'The three cards you are looking at:',
    kitYours: 'Pick two to keep; the other goes back on the deck.',
    take: (card) => (card ? `Take ${card}` : 'Take'),
    takeTwo: 'Keep the two picked',
  },
  draw: {
    choose: (fromPlayers) =>
      fromPlayers
        ? 'Choose where your first card comes from: the deck, or click a lit player to draw from their hand.'
        : 'Choose where the first card of your turn comes from.',
    deck: 'Draw 2 from the deck',
    discard: (card) => `Take ${card ?? 'the top card'} from the discard pile`,
  },
  button: {
    play: (card) => `Play ${card}`,
    endTurn: 'End turn',
    endTurnDiscard: (count) => `End turn (discard ${count})`,
    discardAndEnd: (count) => `Discard ${cards(count)} and end turn`,
    back: 'Back',
    respond: (card) => (card ? `Answer with ${card}` : 'Answer'),
    takeHit: 'Lose 1 life',
    giveUp: 'Accept being eliminated',
  },

  hand: {
    title: 'Your hand',
    count: (count, limit) =>
      limit === null ? cards(count) : `${cards(count)} · you may keep ${limit} at the end of turn`,
    empty: 'You hold no cards.',
    unplayable: 'Cannot be played right now.',
  },
  you: { title: 'You are', role: 'Role', character: 'Character' },
  cast: { title: 'Roles in this match', hint: 'A role is shown when its player is eliminated.' },
  log: {
    title: 'Log',
    empty: 'Nothing has happened yet.',
    describe(entry, nameOf) {
      const who = nameOf(entry.playerId);
      switch (entry.type) {
        case 'TURN':
          return `${who}’s turn`;
        case 'PLAY':
          return entry.targetId
            ? `${who} plays ${EN_CARD[entry.card.kind]} on ${nameOf(entry.targetId)}.`
            : `${who} plays ${EN_CARD[entry.card.kind]}.`;
        case 'RESPONSE':
          return `${who} answers with ${EN_CARD[entry.card.kind]}.`;
        case 'CHECK': {
          const check = EN_CHECK[entry.reason];
          const flipped = entry.cards.map(pipLabel).join(', ') || 'no cards left';
          return `${who} flips for ${check.name} (${flipped}): ${entry.passed ? check.passed : check.failed}.`;
        }
        case 'HIT':
          return entry.sourceId
            ? `${who} loses ${entry.amount} life to ${nameOf(entry.sourceId)}.`
            : `${who} loses ${entry.amount} life.`;
        case 'DRAW':
          if (entry.from === 'discard') {
            return `${who} takes ${entry.shown ? EN_CARD[entry.shown.kind] : 'a card'} from the discard pile.`;
          }
          return entry.shown
            ? `${who} draws ${cards(entry.count)}, showing ${EN_CARD[entry.shown.kind]} ${pipLabel(entry.shown)}.`
            : `${who} draws ${cards(entry.count)}.`;
        case 'TAKE': {
          const what = entry.card
            ? EN_CARD[entry.card.kind]
            : entry.fromHand
              ? 'a card in hand'
              : 'a card';
          return entry.discarded
            ? `${who} makes ${nameOf(entry.fromId)} discard ${what}.`
            : `${who} takes ${what} from ${nameOf(entry.fromId)}.`;
        }
        case 'PICK':
          return `${who} takes ${EN_CARD[entry.card.kind]} at the General Store.`;
        case 'DISCARD':
          if (entry.reason === 'penalty') {
            return `${who} loses every card for taking down a Deputy.`;
          }
          return entry.reason === 'heal'
            ? `${who} discards ${names(entry.cards, EN_CARD)} for 1 life.`
            : `${who} discards ${names(entry.cards, EN_CARD)}.`;
        case 'DEATH': {
          const by = entry.killerId ? ` by ${nameOf(entry.killerId)}` : '';
          const loot = entry.lootedById ? ` ${nameOf(entry.lootedById)} takes their cards.` : '';
          return `${who} is eliminated${by}: the ${EN_ROLE[entry.role]}.${loot}`;
        }
      }
    },
  },
  credit: 'Icons: Lorc, Delapouite, Skoll, Faithtoken, Sbed and others',
};

export const BANG_TEXT: Record<Locale, BangText> = { vi, en };
