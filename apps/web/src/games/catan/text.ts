import type { DevelopmentCardType, Resource, Terrain } from '@bgp/game-catan';
import type { Locale } from '../../shared/i18n/locales';

/**
 * Everything the CATAN table says, one set per language of `shared/i18n/locales.ts`. What it
 * explains to a newcomer on top of that is in `hints.ts`.
 */

const EN_RESOURCE: Record<Resource, string> = {
  brick: 'Brick',
  wood: 'Wood',
  wool: 'Wool',
  wheat: 'Wheat',
  ore: 'Ore',
};

const VI_RESOURCE: Record<Resource, string> = {
  brick: 'Gạch',
  wood: 'Gỗ',
  wool: 'Len',
  wheat: 'Lúa',
  ore: 'Quặng',
};

const EN_TERRAIN: Record<Terrain, string> = {
  hills: 'Hills',
  forest: 'Forest',
  pasture: 'Pasture',
  fields: 'Fields',
  mountains: 'Mountains',
  desert: 'Desert',
};

const VI_TERRAIN: Record<Terrain, string> = {
  hills: 'Đồi đất sét',
  forest: 'Rừng',
  pasture: 'Đồng cỏ',
  fields: 'Cánh đồng',
  mountains: 'Núi',
  desert: 'Sa mạc',
};

const EN_CARD: Record<DevelopmentCardType, string> = {
  knight: 'Knight',
  victoryPoint: 'Victory Point',
  roadBuilding: 'Road Building',
  invention: 'Invention',
  monopoly: 'Monopoly',
};

const VI_CARD: Record<DevelopmentCardType, string> = {
  knight: 'Hiệp sĩ',
  victoryPoint: 'Điểm thắng',
  roadBuilding: 'Xây đường',
  invention: 'Phát minh',
  monopoly: 'Độc quyền',
};

const enAmount = (count: number, resource: Resource) =>
  `${count} ${EN_RESOURCE[resource].toLowerCase()}`;
const viAmount = (count: number, resource: Resource) =>
  `${count} ${VI_RESOURCE[resource].toLowerCase()}`;

const en = {
  resource: EN_RESOURCE,
  terrain: EN_TERRAIN,
  card: EN_CARD,
  cardHint: {
    knight: 'Move the robber and rob a player next to it.',
    victoryPoint: 'Worth 1 point. Stays hidden until you win.',
    roadBuilding: 'Place 2 roads for free.',
    invention: 'Take any 2 cards from the supply.',
    monopoly: 'Every other player gives you all their cards of one resource.',
  } as Record<DevelopmentCardType, string>,
  /** So many cards of a resource, e.g. "3 wheat". */
  amount: enAmount,
  nothing: 'nothing',
  oneFewer: (resource: Resource) => `One ${EN_RESOURCE[resource].toLowerCase()} fewer`,
  oneMore: (resource: Resource) => `One ${EN_RESOURCE[resource].toLowerCase()} more`,

  // Whose turn it is, and what is being waited for.
  gameOver: 'Game over',
  yourTurn: 'Your turn',
  turnOf: (name: string) => `${name}’s turn`,
  turnNumber: (turn: number) => `Turn ${turn}`,
  status: {
    won: (names: string[]) => `${names.join(' & ')} won the game.`,
    over: 'Game over.',
    discard: (count: number) => `A 7 was rolled. Discard ${count} of your cards.`,
    waitingDiscard: (names: string[]) =>
      `A 7 was rolled. Waiting for ${names.join(', ')} to discard.`,
    offersYou: (name: string) => `${name} offers you a trade. Accept or decline it.`,
    hasOffer: (name: string) => `${name} has a trade on offer.`,
    placingSettlement: (name: string) => `${name} is placing a settlement.`,
    placingRoad: (name: string) => `${name} is placing a road.`,
    movingRobber: (name: string) => `${name} is moving the robber.`,
    aboutToRoll: (name: string) => `${name} is about to roll.`,
    building: (name: string) => `${name} is building and trading.`,
    yourOffer: 'Your offer is on the table. Close it with a player, or withdraw it.',
    placeSettlement: 'Place a settlement on a highlighted corner.',
    placeRoad: 'Place a road from that settlement.',
    chooseVictim: 'Choose who to rob.',
    moveRobber: 'Move the robber to a highlighted hex.',
    freeRoads: (count: number) => `Place ${count} free ${count === 1 ? 'road' : 'roads'}.`,
    monopoly: 'Monopoly: name the resource to collect.',
    invention: (count: number) => `Invention: take ${count} from the supply.`,
    rollOrCard: 'Roll the dice, or play a development card first.',
    roll: 'Roll the dice.',
    main: 'Build, trade, play a card, or end your turn.',
    tool: {
      road: 'Pick a highlighted edge for your road.',
      settlement: 'Pick a highlighted corner for your settlement.',
      city: 'Pick one of your settlements to make it a city.',
    },
  },
  rolled: (first: number, second: number) => `Rolled ${first} and ${second}`,
  notRolled: 'Not rolled yet',

  // The board.
  island: 'The island',
  producesOn: (terrain: Terrain, number: number) => `${EN_TERRAIN[terrain]}, produces on ${number}`,
  robberHere: (description: string) => `${description}. The robber is here.`,
  portAny: 'Port: any 3 of a kind for 1',
  portOf: (resource: Resource) => `Port: 2 ${EN_RESOURCE[resource].toLowerCase()} for 1`,
  any: 'any',
  moveRobberTo: (terrain: Terrain, hex: string) =>
    `Move the robber to the ${EN_TERRAIN[terrain]} at ${hex}`,
  roadOf: (name: string) => `Road of ${name}`,
  settlementOf: (name: string) => `Settlement of ${name}`,
  cityOf: (name: string) => `City of ${name}`,
  buildRoadHere: 'Build a road here',
  buildSettlementHere: 'Build a settlement here',
  buildCityHere: 'Build a city here',

  // The viewer's hand and what they can do.
  dock: 'Your hand and what you can do',
  fresh: 'new',
  freshHint: 'Bought this turn: it can be played from your next turn.',
  play: 'Play',
  rollDice: 'Roll dice',
  build: 'Build',
  road: 'Road',
  settlement: 'Settlement',
  city: 'City',
  devCard: 'Dev card',
  buyDevCard: 'Buy a development card',
  costs: (price: string) => `Costs ${price}`,
  trade: 'Trade',
  endTurn: 'End turn',
  rob: (name: string) => `Rob ${name}`,
  anotherHex: 'Another hex',
  cancel: 'Cancel',
  cardsToDiscard: 'Cards to discard',
  discard: (picked: number, owed: number) => `Discard ${picked} / ${owed}`,

  // The table of players.
  you: '(you)',
  turnMark: 'Turn',
  pointsOnTable: 'Points on the table',
  yourPoints: 'Your points',
  points: 'points',
  stat: {
    hand: 'Cards in hand',
    developmentCards: 'Development cards',
    knights: 'Knights played',
    route: 'Longest route',
  },
  longestRoute: 'Longest Route',
  largestArmy: 'Largest Army',
  holds: (stat: string, award: string) => `${stat}: ${award}, +2 points`,
  pointsFor: (award: string) => `points for ${award}`,
  leftToBuild: (roads: number, settlements: number, cities: number) =>
    `Left to build: ${roads} roads, ${settlements} settlements, ${cities} cities`,
  discarding: (count: number) => `Discarding ${count}`,
  accepts: 'Accepts',
  declines: 'Declines',
  bank: 'Bank',
  deckLeft: (count: number) => `${count} development cards left`,
  firstTo: (points: number) => `First to ${points} points wins.`,

  // Trading.
  closeTrade: 'Close trade',
  tradeWith: 'Who to trade with',
  bankAndPorts: 'Bank & ports',
  players: 'Players',
  oneOfferAtATime: 'One offer at a time: this one has to be closed first.',
  tradeOpensLater: 'Trading opens on your own turn, once the dice are rolled.',
  youGive: 'You give',
  youGet: 'You get',
  youWant: 'You want',
  resourceToGive: 'Resource to give',
  resourceToGet: 'Resource to get',
  leftInSupply: (count: number) => `${count} left`,
  getOne: (resource: Resource, left: number) =>
    `1 ${EN_RESOURCE[resource].toLowerCase()}, ${left} left in the supply`,
  tradeFor: (rate: number, give: Resource, receive: Resource) =>
    `Trade ${enAmount(rate, give)} for ${enAmount(1, receive)}`,
  pickGiveAndGet: 'Pick what to give and get',
  cardsYouGive: 'Cards you give',
  cardsYouWant: 'Cards you want',
  offerToTable: 'Offer to the table',
  youOffer: 'You offer',
  offers: (name: string) => `${name} offers`,
  for: 'for',
  tradeWithPlayer: (name: string) => `Trade with ${name}`,
  withdraw: 'Withdraw offer',
  waitingFor: (names: string[]) => `Waiting for ${names.join(', ')}.`,
  everyoneDeclined: 'Everyone declined.',
  everyoneAnswered: 'Everyone has answered.',
  accept: 'Accept',
  decline: 'Decline',
  cannotAccept: 'You do not hold those cards.',
  youAnswered: (accepted: boolean, name: string) =>
    `You ${accepted ? 'accepted' : 'declined'}. It is up to ${name} now.`,

  // The costs guide.
  guide: {
    title: 'Building costs and points',
    developmentCard: 'Development card',
    road: (minimum: number) => `Longest Route, ${minimum} or more in a row, is worth 2 points.`,
    settlement: '1 point. Collects 1 card from each hex around it.',
    city: '2 points. Replaces a settlement and collects 2 cards.',
    card: 'A knight, a Victory Point or a one-off effect.',
    rules: (target: number, army: number, limit: number) =>
      `The first player to reach ${target} points on their own turn wins. Largest Army, ${army} or more knights played, is worth 2 points. On a 7 nothing is produced, every hand of more than ${limit} cards loses half, and the robber moves.`,
    legend: {
      hand: 'cards in hand',
      developmentCards: 'development cards',
      knights: 'knights played',
      route: 'longest route',
    },
    iconsBy: 'Icons by Lorc, Delapouite, Faithtoken and Skoll from',
    under: 'under',
  },
};

export type CatanText = typeof en;

const vi: CatanText = {
  resource: VI_RESOURCE,
  terrain: VI_TERRAIN,
  card: VI_CARD,
  cardHint: {
    knight: 'Di chuyển kẻ cướp và cướp một người chơi ở cạnh nó.',
    victoryPoint: 'Được 1 điểm. Giữ kín cho đến khi bạn thắng.',
    roadBuilding: 'Đặt 2 con đường miễn phí.',
    invention: 'Lấy 2 lá bất kỳ từ ngân hàng.',
    monopoly: 'Mọi người chơi khác đưa bạn toàn bộ bài của một loại tài nguyên.',
  },
  amount: viAmount,
  nothing: 'không có gì',
  oneFewer: (resource) => `Bớt một ${VI_RESOURCE[resource].toLowerCase()}`,
  oneMore: (resource) => `Thêm một ${VI_RESOURCE[resource].toLowerCase()}`,

  gameOver: 'Ván đã kết thúc',
  yourTurn: 'Lượt của bạn',
  turnOf: (name) => `Lượt của ${name}`,
  turnNumber: (turn) => `Lượt ${turn}`,
  status: {
    won: (names) => `${names.join(' & ')} đã thắng ván này.`,
    over: 'Ván đã kết thúc.',
    discard: (count) => `Xúc xắc ra 7. Hãy bỏ ${count} lá bài của bạn.`,
    waitingDiscard: (names) => `Xúc xắc ra 7. Đang chờ ${names.join(', ')} bỏ bài.`,
    offersYou: (name) => `${name} mời bạn đổi bài. Hãy đồng ý hoặc từ chối.`,
    hasOffer: (name) => `${name} đang mời đổi bài.`,
    placingSettlement: (name) => `${name} đang đặt nhà.`,
    placingRoad: (name) => `${name} đang đặt đường.`,
    movingRobber: (name) => `${name} đang di chuyển kẻ cướp.`,
    aboutToRoll: (name) => `${name} sắp đổ xúc xắc.`,
    building: (name) => `${name} đang xây và giao thương.`,
    yourOffer: 'Lời mời của bạn đang chờ. Chốt với một người chơi, hoặc rút lại.',
    placeSettlement: 'Đặt một ngôi nhà lên một góc được đánh dấu.',
    placeRoad: 'Đặt một con đường nối từ ngôi nhà đó.',
    chooseVictim: 'Chọn người để cướp.',
    moveRobber: 'Chuyển kẻ cướp tới một ô được đánh dấu.',
    freeRoads: (count) => `Đặt ${count} con đường miễn phí.`,
    monopoly: 'Độc quyền: chọn loại tài nguyên muốn thu.',
    invention: (count) => `Phát minh: lấy ${count} lá từ ngân hàng.`,
    rollOrCard: 'Đổ xúc xắc, hoặc dùng một thẻ phát triển trước.',
    roll: 'Đổ xúc xắc.',
    main: 'Xây, giao thương, dùng thẻ, hoặc kết thúc lượt.',
    tool: {
      road: 'Chọn một cạnh được đánh dấu để đặt đường.',
      settlement: 'Chọn một góc được đánh dấu để đặt nhà.',
      city: 'Chọn một ngôi nhà của bạn để nâng lên thành phố.',
    },
  },
  rolled: (first, second) => `Đổ ra ${first} và ${second}`,
  notRolled: 'Chưa đổ xúc xắc',

  island: 'Hòn đảo',
  producesOn: (terrain, number) => `${VI_TERRAIN[terrain]}, sinh tài nguyên khi ra ${number}`,
  robberHere: (description) => `${description}. Kẻ cướp đang ở đây.`,
  portAny: 'Cảng: 3 lá cùng loại bất kỳ đổi 1',
  portOf: (resource) => `Cảng: 2 ${VI_RESOURCE[resource].toLowerCase()} đổi 1`,
  any: 'mọi',
  moveRobberTo: (terrain, hex) => `Chuyển kẻ cướp tới ô ${VI_TERRAIN[terrain]} tại ${hex}`,
  roadOf: (name) => `Đường của ${name}`,
  settlementOf: (name) => `Nhà của ${name}`,
  cityOf: (name) => `Thành phố của ${name}`,
  buildRoadHere: 'Xây đường ở đây',
  buildSettlementHere: 'Xây nhà ở đây',
  buildCityHere: 'Xây thành phố ở đây',

  dock: 'Bài trên tay và những việc bạn có thể làm',
  fresh: 'mới',
  freshHint: 'Mua trong lượt này: dùng được từ lượt sau của bạn.',
  play: 'Dùng',
  rollDice: 'Đổ xúc xắc',
  build: 'Xây dựng',
  road: 'Đường',
  settlement: 'Nhà',
  city: 'Thành phố',
  devCard: 'Thẻ',
  buyDevCard: 'Mua một thẻ phát triển',
  costs: (price) => `Giá: ${price}`,
  trade: 'Đổi bài',
  endTurn: 'Hết lượt',
  rob: (name) => `Cướp ${name}`,
  anotherHex: 'Chọn ô khác',
  cancel: 'Huỷ',
  cardsToDiscard: 'Bài cần bỏ',
  discard: (picked, owed) => `Bỏ ${picked} / ${owed}`,

  you: '(bạn)',
  turnMark: 'Lượt',
  pointsOnTable: 'Điểm đang thấy trên bàn',
  yourPoints: 'Điểm của bạn',
  points: 'điểm',
  stat: {
    hand: 'Bài trên tay',
    developmentCards: 'Thẻ phát triển',
    knights: 'Hiệp sĩ đã dùng',
    route: 'Đường dài nhất',
  },
  longestRoute: 'Đường Dài Nhất',
  largestArmy: 'Đội Quân Lớn Nhất',
  holds: (stat, award) => `${stat}: ${award}, +2 điểm`,
  pointsFor: (award) => `điểm nhờ ${award}`,
  leftToBuild: (roads, settlements, cities) =>
    `Còn để xây: ${roads} đường, ${settlements} nhà, ${cities} thành phố`,
  discarding: (count) => `Đang bỏ ${count}`,
  accepts: 'Đồng ý',
  declines: 'Từ chối',
  bank: 'Ngân hàng',
  deckLeft: (count) => `Còn ${count} thẻ phát triển`,
  firstTo: (points) => `Ai đạt ${points} điểm trước sẽ thắng.`,

  closeTrade: 'Đóng bảng đổi bài',
  tradeWith: 'Đổi bài với ai',
  bankAndPorts: 'Ngân hàng & cảng',
  players: 'Người chơi',
  oneOfferAtATime: 'Mỗi lúc chỉ một lời mời: phải chốt hoặc rút lời mời này trước.',
  tradeOpensLater: 'Chỉ đổi bài được trong lượt của bạn, sau khi đổ xúc xắc.',
  youGive: 'Bạn đưa',
  youGet: 'Bạn nhận',
  youWant: 'Bạn muốn',
  resourceToGive: 'Tài nguyên đưa đi',
  resourceToGet: 'Tài nguyên nhận về',
  leftInSupply: (count) => `còn ${count}`,
  getOne: (resource, left) => `1 ${VI_RESOURCE[resource].toLowerCase()}, ngân hàng còn ${left}`,
  tradeFor: (rate, give, receive) => `Đổi ${viAmount(rate, give)} lấy ${viAmount(1, receive)}`,
  pickGiveAndGet: 'Chọn thứ đưa và thứ nhận',
  cardsYouGive: 'Bài bạn đưa',
  cardsYouWant: 'Bài bạn muốn',
  offerToTable: 'Mời cả bàn',
  youOffer: 'Bạn mời đổi',
  offers: (name) => `${name} mời đổi`,
  for: 'lấy',
  tradeWithPlayer: (name) => `Đổi với ${name}`,
  withdraw: 'Rút lời mời',
  waitingFor: (names) => `Đang chờ ${names.join(', ')}.`,
  everyoneDeclined: 'Mọi người đều từ chối.',
  everyoneAnswered: 'Mọi người đã trả lời.',
  accept: 'Đồng ý',
  decline: 'Từ chối',
  cannotAccept: 'Bạn không có những lá đó.',
  youAnswered: (accepted, name) =>
    `Bạn đã ${accepted ? 'đồng ý' : 'từ chối'}. Giờ tuỳ ${name} quyết định.`,

  guide: {
    title: 'Giá xây dựng và điểm',
    developmentCard: 'Thẻ phát triển',
    road: (minimum) => `Đường Dài Nhất, từ ${minimum} đoạn nối liền trở lên, được 2 điểm.`,
    settlement: '1 điểm. Nhận 1 lá từ mỗi ô quanh nó.',
    city: '2 điểm. Thay cho một ngôi nhà và nhận 2 lá.',
    card: 'Một hiệp sĩ, một Điểm thắng hoặc một hiệu ứng dùng một lần.',
    rules: (target, army, limit) =>
      `Người đầu tiên đạt ${target} điểm trong lượt của mình sẽ thắng. Đội Quân Lớn Nhất, từ ${army} hiệp sĩ đã dùng trở lên, được 2 điểm. Khi ra 7, không ô nào sinh tài nguyên, ai cầm hơn ${limit} lá phải bỏ một nửa, và kẻ cướp di chuyển.`,
    legend: {
      hand: 'bài trên tay',
      developmentCards: 'thẻ phát triển',
      knights: 'hiệp sĩ đã dùng',
      route: 'đường dài nhất',
    },
    iconsBy: 'Icon của Lorc, Delapouite, Faithtoken và Skoll từ',
    under: 'theo giấy phép',
  },
};

export const CATAN_TEXT: Record<Locale, CatanText> = { vi, en };
