import {
  TERRAINS,
  TERRAIN_RESOURCE,
  type CatanView,
  type DevelopmentCardType,
  type PortType,
  type Resource,
  type Terrain,
} from '@bgp/game-catan';
import type { Locale } from '../../shared/i18n/locales';
import { useLocale } from '../../shared/i18n/useT';
import { CATAN_TEXT, type CatanText } from './text';

/** What a newcomer is told about one thing on the table. */
export interface Hint {
  title?: string;
  body: string;
  /** A tip on playing well, or a rule that is easy to miss. Set apart from the body. */
  advice?: string;
}

/** The numbers a match plays by. Hints quote them, so they stay true under any config. */
export type HintRules = Pick<
  CatanView,
  'victoryPointsToWin' | 'longestRouteMinimum' | 'largestArmyMinimum' | 'discardLimit'
>;

/** What is being asked of the viewer right now, as far as explaining it goes. */
export type StepHint =
  | 'setupSettlement'
  | 'setupRoad'
  | 'roll'
  | 'discard'
  | 'robber'
  | 'freeRoads'
  | 'offer'
  | 'respond'
  | 'build'
  | 'waiting'
  | 'watching'
  | 'finished';

/** The counts a player's panel shows as bare icons. */
export type StatHint = 'hand' | 'developmentCards' | 'knights' | 'route';

export interface Hints {
  /** Names the button that explains the current step. */
  help: string;
  cost: string;
  /** What the dots under a build button mean. */
  costPips: string;
  step: Record<StepHint, (rules: HintRules) => Hint>;
  dice(rules: HintRules): Hint;
  rollDice: Hint;
  road(rules: HintRules): Hint;
  settlement: Hint;
  city: Hint;
  developmentCard(deckCount: number): Hint;
  trade: Hint;
  endTurn(rules: HintRules): Hint;
  resource(resource: Resource): Hint;
  card(type: DevelopmentCardType, rules: HintRules): Hint;
  /** `resource` is what the hex produces, `odds` how many of the 36 rolls make its number. */
  hex(terrain: Terrain, resource: Resource, number: number, odds: number): Hint;
  desert: Hint;
  robberHere: string;
  port(type: PortType): Hint;
  roadOf(name: string): Hint;
  settlementOf(name: string): Hint;
  cityOf(name: string): Hint;
  /** `hidden`: somebody else's score, which leaves out their Victory Point cards. */
  score(rules: HintRules, hidden: boolean): Hint;
  /** Without a title: the panel names the count, and says who holds its award. */
  stat: Record<StatHint, (rules: HintRules) => Hint>;
  pieces: Hint;
  bank: Hint;
  bankTrade: Hint;
  playerTrade: Hint;
}

/** The terrain a resource comes from. */
function terrainOf(resource: Resource): Terrain {
  return TERRAINS.find((terrain) => TERRAIN_RESOURCE[terrain] === resource) ?? 'desert';
}

// The names of things come from the table's own text, so a hint never calls them otherwise.

function vi(t: CatanText): Hints {
  const oneCardATurn = 'Mỗi lượt chỉ dùng 1 thẻ phát triển, và không dùng được thẻ vừa mua.';
  return {
    help: 'Giải thích bước này',
    cost: 'Giá:',
    costPips: 'Mỗi chấm dưới nút là một lá phải trả; chấm rỗng là lá bạn còn thiếu.',
    step: {
      setupSettlement: () => ({
        title: 'Đặt nhà mở đầu',
        body: 'Mỗi người đặt 2 ngôi nhà, mỗi nhà kèm 1 con đường; vòng thứ hai đi theo thứ tự ngược lại. Ngôi nhà thứ hai cho bạn ngay 1 lá từ mỗi ô quanh nó. Hai công trình không được nằm ở hai góc kề nhau.',
        advice: 'Mẹo: chọn góc chạm ba ô khác loại, có số nhiều chấm. 6 và 8 ra nhiều nhất.',
      }),
      setupRoad: () => ({
        title: 'Đặt đường mở đầu',
        body: 'Con đường này phải nối từ ngôi nhà vừa đặt.',
        advice: 'Mẹo: hướng nó về chỗ bạn muốn xây nhà tiếp theo, hoặc về một cảng.',
      }),
      roll: () => ({
        title: t.rollDice,
        body: 'Lượt nào cũng bắt đầu bằng đổ xúc xắc. Ô mang số vừa ra sinh tài nguyên cho mọi người có nhà hoặc thành phố ở góc ô đó, kể cả người không tới lượt. Bạn được dùng 1 thẻ phát triển trước khi đổ.',
      }),
      discard: (rules) => ({
        title: 'Xúc xắc ra 7',
        body: `Không ô nào sinh tài nguyên. Ai cầm hơn ${rules.discardLimit} lá phải bỏ một nửa (làm tròn xuống), rồi người đổ xúc xắc di chuyển kẻ cướp.`,
        advice: `Mẹo: xây hoặc đổi bớt để cuối lượt không cầm quá ${rules.discardLimit} lá.`,
      }),
      robber: () => ({
        title: 'Di chuyển kẻ cướp',
        body: 'Chọn một ô khác cho kẻ cướp. Ô có kẻ cướp không sinh tài nguyên. Nếu người khác có nhà hoặc thành phố ở góc ô đó, bạn rút ngẫu nhiên 1 lá của một người trong số họ.',
        advice: 'Mẹo: chặn ô có số hay ra của người đang dẫn đầu.',
      }),
      freeRoads: () => ({
        title: 'Đường miễn phí',
        body: `Thẻ ${t.card.roadBuilding} cho bạn đặt đường mà không tốn tài nguyên. Đặt hết rồi mới làm được việc khác.`,
      }),
      offer: () => ({
        title: 'Lời mời của bạn',
        body: `Chờ những người khác trả lời. Ai đồng ý sẽ hiện thành nút “${t.tradeWithPlayer('…')}”: bấm để đổi với người đó, hoặc bấm “${t.withdraw}”.`,
      }),
      respond: () => ({
        title: 'Có người mời đổi bài',
        body: `Xem lời mời rồi chọn “${t.accept}” hoặc “${t.decline}”. Chỉ đồng ý được khi bạn có đủ những lá họ muốn.`,
        advice: 'Đồng ý chưa chắc đã đổi: người mời chọn một trong những người đồng ý.',
      }),
      build: (rules) => ({
        title: 'Xây và giao thương',
        body: `Sau khi đổ xúc xắc, bạn làm bao nhiêu việc tuỳ thích, theo thứ tự bất kỳ: xây đường, nhà, thành phố, mua thẻ phát triển, đổi bài với ngân hàng hoặc với người khác. Xong thì bấm “${t.endTurn}”.`,
        advice: `Mục tiêu: đạt ${rules.victoryPointsToWin} điểm trong lượt của mình trước mọi người.`,
      }),
      waiting: () => ({
        title: 'Chờ tới lượt',
        body: 'Bạn vẫn nhận tài nguyên khi số trên các ô của bạn ra, và có thể trả lời lời mời đổi bài của người đang tới lượt.',
      }),
      watching: () => ({
        title: 'Đang xem',
        body: 'Bạn đang xem ván này. Bài trên tay người chơi được giấu cho tới khi ván kết thúc.',
      }),
      finished: (rules) => ({
        title: t.gameOver,
        body: `Người đầu tiên đạt ${rules.victoryPointsToWin} điểm trong lượt của mình là người thắng. Giờ bài trên tay mọi người đều được lật ra.`,
      }),
    },
    dice: (rules) => ({
      title: 'Xúc xắc',
      body: `Tổng hai viên quyết định ô nào sinh tài nguyên. Ra 7 thì không ô nào sinh, ai cầm hơn ${rules.discardLimit} lá phải bỏ một nửa, và người đổ di chuyển kẻ cướp.`,
      advice: '7 là tổng hay ra nhất; 2 và 12 hiếm nhất.',
    }),
    rollDice: {
      title: t.rollDice,
      body: 'Bắt đầu lượt của bạn. Ô mang số vừa ra sinh tài nguyên cho mọi nhà và thành phố ở góc ô đó.',
    },
    road: (rules) => ({
      title: t.road,
      body: 'Nối tiếp từ đường, nhà hoặc thành phố của bạn. Nhà mới phải nằm trên đường của bạn, nên muốn mở rộng thì làm đường trước.',
      advice: `Tuyến đường liền dài nhất bàn, từ ${rules.longestRouteMinimum} đoạn trở lên, được +2 điểm.`,
    }),
    settlement: {
      title: t.settlement,
      body: '1 điểm. Mỗi khi một ô quanh nó ra số, bạn nhận 1 lá. Nhà phải nằm trên đường của bạn và không kề góc với công trình nào khác.',
    },
    city: {
      title: t.city,
      body: '2 điểm. Thay cho một ngôi nhà của bạn, và nhận 2 lá thay vì 1 mỗi khi một ô quanh nó ra số.',
    },
    developmentCard: (deckCount) => ({
      title: t.guide.developmentCard,
      body: `Rút ngẫu nhiên 1 thẻ từ chồng thẻ (còn ${deckCount}): ${t.card.knight}, ${t.card.victoryPoint} hoặc một thẻ hiệu ứng.`,
      advice: 'Thẻ vừa mua phải chờ tới lượt sau mới dùng được, và mỗi lượt chỉ dùng 1 thẻ.',
    }),
    trade: {
      title: t.trade,
      body: 'Trong lượt của bạn, sau khi đổ xúc xắc: đổi với ngân hàng, 4 lá cùng loại lấy 1 lá tuỳ chọn và rẻ hơn nếu có cảng, hoặc mời người chơi khác đổi bài.',
    },
    endTurn: (rules) => ({
      title: t.endTurn,
      body: 'Chuyển lượt cho người kế tiếp. Thẻ chưa dùng vẫn giữ lại cho các lượt sau.',
      advice: `Cầm hơn ${rules.discardLimit} lá thì mất một nửa nếu có người đổ ra 7.`,
    }),
    resource: (resource) => ({
      title: t.resource[resource],
      body: `Do các ô ${t.terrain[terrainOf(resource)]} sinh ra.`,
    }),
    card: (type, rules) => ({
      title: t.card[type],
      body: t.cardHint[type],
      advice:
        type === 'knight'
          ? `Ai dùng nhiều ${t.card.knight} nhất, từ ${rules.largestArmyMinimum} thẻ trở lên, giữ ${t.largestArmy}: +2 điểm.`
          : type === 'victoryPoint'
            ? 'Không cần dùng: thẻ tự tính vào điểm của bạn.'
            : oneCardATurn,
    }),
    hex: (terrain, resource, number, odds) => ({
      title: `${t.terrain[terrain]} · ${number}`,
      body: `Mỗi lần đổ ra ${number}, mỗi ngôi nhà ở góc ô này nhận ${t.amount(1, resource)}, mỗi thành phố nhận 2. Số này ra ${odds} trong 36 lần đổ: càng nhiều chấm dưới số thì càng hay ra.`,
    }),
    desert: { title: t.terrain.desert, body: 'Không sinh tài nguyên. Kẻ cướp bắt đầu ở đây.' },
    robberHere: 'Kẻ cướp đang ở đây: ô này không sinh tài nguyên cho tới khi hắn bị chuyển đi.',
    port: (type) => ({
      title: type === 'any' ? t.portAny : t.portOf(type),
      body: 'Có nhà hoặc thành phố ở một trong hai góc nối với cảng thì bạn đổi với ngân hàng theo tỉ lệ này, thay vì 4 lá lấy 1.',
    }),
    roadOf: (name) => ({
      title: t.roadOf(name),
      body: 'Đường nối các công trình và mở chỗ xây nhà mới.',
    }),
    settlementOf: (name) => ({ title: t.settlementOf(name), body: t.guide.settlement }),
    cityOf: (name) => ({ title: t.cityOf(name), body: t.guide.city }),
    score: (rules, hidden) => ({
      title: hidden ? t.pointsOnTable : t.yourPoints,
      body: `Nhà 1 điểm, thành phố 2 điểm, ${t.longestRoute} +2, ${t.largestArmy} +2, mỗi thẻ ${t.card.victoryPoint} 1 điểm. Ai đạt ${rules.victoryPointsToWin} điểm trong lượt của mình thì thắng.`,
      advice: hidden
        ? `Thẻ ${t.card.victoryPoint} của người khác được giấu, nên điểm thật của họ có thể cao hơn.`
        : undefined,
    }),
    stat: {
      hand: (rules) => ({
        body: `Số lá tài nguyên đang cầm. Khi có người đổ ra 7, ai cầm hơn ${rules.discardLimit} lá phải bỏ một nửa.`,
      }),
      developmentCards: () => ({
        body: 'Số thẻ phát triển chưa dùng. Người khác không biết đó là thẻ gì cho tới khi chúng được dùng.',
      }),
      knights: (rules) => ({
        body: `Ai dùng nhiều ${t.card.knight} nhất, từ ${rules.largestArmyMinimum} thẻ trở lên, giữ ${t.largestArmy}: +2 điểm.`,
        advice: 'Người khác dùng nhiều hơn thì lấy mất danh hiệu.',
      }),
      route: (rules) => ({
        body: `Số đoạn đường nối liền dài nhất của người này. Ai dài nhất bàn, từ ${rules.longestRouteMinimum} đoạn trở lên, giữ ${t.longestRoute}: +2 điểm.`,
        advice: 'Nhà hoặc thành phố của người khác chen vào giữa sẽ cắt đứt tuyến đường.',
      }),
    },
    pieces: {
      body: 'Mỗi người chỉ có chừng này quân để xây. Nâng nhà lên thành phố sẽ trả lại quân nhà.',
    },
    bank: {
      title: t.bank,
      body: 'Số lá tài nguyên còn trong ngân hàng. Khi ngân hàng không đủ một loại để phát cho mọi người được nhận thì không ai nhận loại đó; nếu chỉ một người được nhận thì họ lấy phần còn lại.',
    },
    bankTrade: {
      title: t.bankAndPorts,
      body: 'Đổi 4 lá cùng loại lấy 1 lá tuỳ chọn. Có nhà hoặc thành phố ở cảng thì rẻ hơn: 3 lấy 1, hoặc 2 lấy 1 với loại ghi trên cảng.',
      advice: 'Tỉ lệ của riêng bạn ghi dưới từng loại tài nguyên.',
    },
    playerTrade: {
      title: t.players,
      body: `Chỉ người đang tới lượt mới được mời, và cuộc đổi nào cũng phải có người đó. Chọn bài bạn đưa và bài bạn muốn rồi bấm “${t.offerToTable}”; ai đồng ý thì bạn chọn một người để đổi.`,
    },
  };
}

function en(t: CatanText): Hints {
  const oneCardATurn = 'Only 1 development card a turn, and never one bought this turn.';
  return {
    help: 'Explain this step',
    cost: 'Cost:',
    costPips: 'Each dot under the button is a card to pay; a hollow dot is one you are short of.',
    step: {
      setupSettlement: () => ({
        title: 'Opening settlements',
        body: 'Everyone places 2 settlements, each with 1 road; the second round runs in reverse order. Your second settlement pays out at once: 1 card from each hex around it. Two buildings may never stand on neighbouring corners.',
        advice:
          'Tip: pick a corner touching three different hexes whose numbers have many dots. 6 and 8 are rolled most often.',
      }),
      setupRoad: () => ({
        title: 'Opening road',
        body: 'This road must start at the settlement you just placed.',
        advice: 'Tip: point it at where you want your next settlement, or at a port.',
      }),
      roll: () => ({
        title: t.rollDice,
        body: 'Every turn starts with a roll. Hexes showing the number rolled pay everyone with a settlement or a city on their corners, whoever’s turn it is. You may play 1 development card before rolling.',
      }),
      discard: (rules) => ({
        title: 'A 7 was rolled',
        body: `No hex produces. Anyone holding more than ${rules.discardLimit} cards discards half, rounded down, and then the roller moves the robber.`,
        advice: `Tip: build or trade so you end your turn with ${rules.discardLimit} cards or fewer.`,
      }),
      robber: () => ({
        title: 'Move the robber',
        body: 'Pick another hex for the robber. The hex it stands on produces nothing. If other players have a settlement or a city on that hex, you take 1 card at random from one of them.',
        advice: 'Tip: block a hex with a good number that the leader depends on.',
      }),
      freeRoads: () => ({
        title: 'Free roads',
        body: `${t.card.roadBuilding} lets you place roads without paying. Place them all before doing anything else.`,
      }),
      offer: () => ({
        title: 'Your offer',
        body: `Wait for the others to answer. Each player who accepts becomes a “${t.tradeWithPlayer('…')}” button: press it to trade with them, or press “${t.withdraw}”.`,
      }),
      respond: () => ({
        title: 'Someone wants to trade',
        body: `Read the offer, then press “${t.accept}” or “${t.decline}”. You can only accept if you hold the cards it asks for.`,
        advice: 'Accepting is not trading yet: the proposer picks one of those who accepted.',
      }),
      build: (rules) => ({
        title: 'Build and trade',
        body: `After the roll you may do as much as you can pay for, in any order: build roads, settlements and cities, buy development cards, and trade with the bank or the other players. Press “${t.endTurn}” when you are done.`,
        advice: `The goal: reach ${rules.victoryPointsToWin} points on your own turn before anyone else.`,
      }),
      waiting: () => ({
        title: 'Waiting for your turn',
        body: 'You still collect resources when the numbers on your hexes are rolled, and you may answer trade offers from the player whose turn it is.',
      }),
      watching: () => ({
        title: 'Watching',
        body: 'You are watching this match. Hands stay hidden until the game is over.',
      }),
      finished: (rules) => ({
        title: t.gameOver,
        body: `The first player to reach ${rules.victoryPointsToWin} points on their own turn wins. Every hand is shown now.`,
      }),
    },
    dice: (rules) => ({
      title: 'Dice',
      body: `Their sum decides which hexes produce. On a 7 nothing is produced, every hand of more than ${rules.discardLimit} cards loses half, and the roller moves the robber.`,
      advice: '7 is the most likely sum; 2 and 12 are the rarest.',
    }),
    rollDice: {
      title: t.rollDice,
      body: 'Starts your turn. Hexes showing the number rolled pay every settlement and city on their corners.',
    },
    road: (rules) => ({
      title: t.road,
      body: 'Continues from one of your roads, settlements or cities. A new settlement must stand on one of your roads, so roads are how you spread.',
      advice: `The longest unbroken route on the table, ${rules.longestRouteMinimum} roads or more, is worth 2 points.`,
    }),
    settlement: {
      title: t.settlement,
      body: '1 point. Collects 1 card whenever a hex around it rolls its number. It must stand on one of your roads, with no building on a neighbouring corner.',
    },
    city: {
      title: t.city,
      body: '2 points. Replaces one of your settlements and collects 2 cards instead of 1 whenever a hex around it rolls its number.',
    },
    developmentCard: (deckCount) => ({
      title: t.guide.developmentCard,
      body: `Draws 1 card at random from the deck (${deckCount} left): a ${t.card.knight}, a ${t.card.victoryPoint} or a one-off effect.`,
      advice: 'A card cannot be played on the turn it was bought, and only 1 may be played a turn.',
    }),
    trade: {
      title: t.trade,
      body: 'On your own turn, once the dice are rolled: trade with the bank, 4 cards of one kind for 1 of your choice and cheaper with a port, or make the other players an offer.',
    },
    endTurn: (rules) => ({
      title: t.endTurn,
      body: 'Passes the turn to the next player. Cards you did not use stay in your hand.',
      advice: `A hand of more than ${rules.discardLimit} cards loses half if anyone rolls a 7.`,
    }),
    resource: (resource) => ({
      title: t.resource[resource],
      body: `Produced by ${t.terrain[terrainOf(resource)]}.`,
    }),
    card: (type, rules) => ({
      title: t.card[type],
      body: t.cardHint[type],
      advice:
        type === 'knight'
          ? `Whoever has played the most ${t.card.knight}s, ${rules.largestArmyMinimum} or more, holds ${t.largestArmy}: 2 points.`
          : type === 'victoryPoint'
            ? 'Never played: it already counts towards your score.'
            : oneCardATurn,
    }),
    hex: (terrain, resource, number, odds) => ({
      title: `${t.terrain[terrain]} · ${number}`,
      body: `Whenever ${number} is rolled, each settlement on a corner of this hex collects ${t.amount(1, resource)} and each city 2. ${odds} of the 36 rolls make this number: the more dots under it, the more often it comes up.`,
    }),
    desert: { title: t.terrain.desert, body: 'Produces nothing. The robber starts here.' },
    robberHere: 'The robber is here: this hex produces nothing until it is moved away.',
    port: (type) => ({
      title: type === 'any' ? t.portAny : t.portOf(type),
      body: 'With a settlement or a city on either corner it joins, you trade with the bank at this rate instead of 4 for 1.',
    }),
    roadOf: (name) => ({
      title: t.roadOf(name),
      body: 'Roads link buildings and open up corners for new settlements.',
    }),
    settlementOf: (name) => ({ title: t.settlementOf(name), body: t.guide.settlement }),
    cityOf: (name) => ({ title: t.cityOf(name), body: t.guide.city }),
    score: (rules, hidden) => ({
      title: hidden ? t.pointsOnTable : t.yourPoints,
      body: `A settlement is 1 point, a city 2, ${t.longestRoute} 2, ${t.largestArmy} 2 and each ${t.card.victoryPoint} card 1. Reach ${rules.victoryPointsToWin} on your own turn to win.`,
      advice: hidden
        ? `Other players’ ${t.card.victoryPoint} cards are hidden, so their real score may be higher.`
        : undefined,
    }),
    stat: {
      hand: (rules) => ({
        body: `How many resource cards are in this hand. When a 7 is rolled, a hand of more than ${rules.discardLimit} loses half.`,
      }),
      developmentCards: () => ({
        body: 'Development cards not played yet. Nobody else knows what they are until they are played.',
      }),
      knights: (rules) => ({
        body: `Whoever has played the most ${t.card.knight}s, ${rules.largestArmyMinimum} or more, holds ${t.largestArmy}: 2 points.`,
        advice: 'It changes hands as soon as somebody has played more.',
      }),
      route: (rules) => ({
        body: `This player’s longest unbroken run of roads. The longest on the table, ${rules.longestRouteMinimum} or more, holds ${t.longestRoute}: 2 points.`,
        advice: 'Somebody else’s settlement or city in the middle cuts a route in two.',
      }),
    },
    pieces: {
      body: 'Each player has only this many pieces to build with. Upgrading to a city hands the settlement back.',
    },
    bank: {
      title: t.bank,
      body: 'The resource cards left in the bank. When it cannot pay everyone their share of a resource, nobody gets any of it; a player who is the only one owed takes what is left.',
    },
    bankTrade: {
      title: t.bankAndPorts,
      body: 'Give 4 cards of one kind for 1 of your choice. A settlement or a city on a port makes it cheaper: 3 for 1, or 2 for 1 for the resource on the port.',
      advice: 'Your own rate is written under each resource.',
    },
    playerTrade: {
      title: t.players,
      body: `Only the player whose turn it is may make an offer, and every trade includes them. Pick what you give and what you want, then press “${t.offerToTable}”; if anyone accepts, you choose who to trade with.`,
    },
  };
}

const HINTS: Record<Locale, Hints> = { vi: vi(CATAN_TEXT.vi), en: en(CATAN_TEXT.en) };

/** The hints for newcomers, in the language the viewer picked. */
export function useHints(): Hints {
  return HINTS[useLocale()];
}
