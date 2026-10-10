import type { HabitatCell, ScoreBreakdown, TokenColor } from '@bgp/game-harmonies';
import type { Locale } from '../../shared/i18n/locales';

/** Everything the Harmonies table says, one set per language of `shared/i18n/locales.ts`. */
export interface HarmoniesText {
  token: Record<TokenColor, string>;
  alerts: { title: string; body: string };

  yourTurn: string;
  turnOf(name: string): string;
  gameOver: string;
  finalRound: string;
  turnNumber(turn: number): string;
  pouch(count: number): string;
  deck(count: number): string;

  status: {
    over: string;
    bot: string;
    waiting(name: string): string;
    holding(name: string): string;
    pickCell: string;
    pickAnimalCell: string;
    take: string;
    place: string;
    extras: string;
  };
  /** The three things a turn is made of, in order. */
  steps: [take: string, place: string, extras: string];
  stepsLabel: string;
  endTurn: string;

  botOn: string;
  botOff: string;
  botPending: string;
  botNote: string;
  soundOn: string;
  soundOff: string;
  notifyOn: string;
  notifyOff: string;
  notifyRequesting: string;
  notifyHint: string;
  notifyUnsupported: string;
  notifyDenied: string;
  controls: string;

  central: string;
  centralHint: string;
  takeSpace(tokens: string[]): string;
  emptySpace: string;

  river: string;
  takeCard: string;
  cardTaken: string;
  noRoomForCard: string;
  howToRead: string;
  howToReadBody: string;

  yourBoard: string;
  boardOf(name: string): string;
  points: string;
  noCards: string;
  placeAnimal: string;
  cancel: string;
  completed(count: number): string;
  cardPoints: string;
  animalsLeft(count: number): string;

  cellEmpty: string;
  cellHeight(height: number): string;
  placeOn(what: string): string;
  justPlayed: string;
  habitat(slot: string, around: string[]): string;
  habitatCell(cell: HabitatCell): string;

  scores: string;
  player: string;
  you: string;
  score: Record<keyof ScoreBreakdown, string>;

  guide: {
    title: string;
    openCard: string;
    cardAlt: Record<'river' | 'islands', string>;
    trees: string;
    treeCount(leaves: string, trunks: string): string;
    trunksOnly: string;
    trunksOnlyNote: string;
    leavesAlone: string;
    leavesOnOne: string;
    leavesOnTwo: string;
    mountains: string;
    mountainAlone: string;
    mountainAloneNote: string;
    mountainNext(height: number): string;
    mountainNextNote: string;
    fields: string;
    fieldAlone: string;
    fieldAloneNote: string;
    fieldGroup: string;
    fieldGroupNote: string;
    buildings: string;
    buildingStack: string;
    buildingFew(colours: number): string;
    buildingSurrounded: string;
    buildingEnough(colours: number): string;
    buildingNote: string;
    water: string;
    riverLong(length: number): string;
    riverNote(longest: number, extra: number): string;
    island: string;
    islandEach: string;
    islandNote: string;
    stacking(pouch: string): string;
    credit: string;
  };
}

const vi: HarmoniesText = {
  token: {
    water: 'Nước',
    mountain: 'Núi',
    trunk: 'Thân cây',
    leaf: 'Lá',
    field: 'Cánh đồng',
    building: 'Nhà',
  },
  alerts: {
    title: 'Harmonies — Đến lượt bạn',
    body: 'Quay lại game để chọn token và xây dựng môi trường sống của bạn.',
  },

  yourTurn: 'Lượt của bạn',
  turnOf: (name) => `Lượt của ${name}`,
  gameOver: 'Ván đấu kết thúc',
  finalRound: 'Vòng cuối',
  turnNumber: (turn) => `Lượt ${turn}`,
  pouch: (count) => `${count} token trong túi`,
  deck: (count) => `${count} thẻ trong chồng`,

  status: {
    over: 'Ván đấu đã kết thúc.',
    bot: 'Bot đang chơi giùm bạn.',
    waiting: (name) => `${name} đang chọn token.`,
    holding: (name) => `${name} đang đặt:`,
    pickCell: 'Chọn một ô đang sáng trên bàn của bạn.',
    pickAnimalCell: 'Chọn ô đang sáng để đặt thú.',
    take: 'Lấy ba token ở một ô của bàn chung.',
    place: 'Chọn một token, rồi chọn ô trên bàn của bạn.',
    extras: 'Lấy thẻ, đặt thú, hoặc kết thúc lượt.',
  },
  steps: ['Lấy token', 'Đặt token', 'Thẻ và thú'],
  stepsLabel: 'Các bước trong lượt',
  endTurn: 'Kết thúc lượt',

  botOn: 'Bật bot chơi giùm',
  botOff: 'Lấy lại quyền chơi',
  botPending: 'Đang chuyển quyền…',
  botNote: 'Bot đang chơi giùm bạn (mức thường), liên tục đến khi bạn tắt.',
  soundOn: 'Âm thanh: Bật',
  soundOff: 'Âm thanh: Tắt',
  notifyOn: 'Bật thông báo',
  notifyOff: 'Tắt thông báo',
  notifyRequesting: 'Đang xin quyền…',
  notifyHint: 'Thông báo khi tab game không mở.',
  notifyUnsupported: 'Thông báo cần HTTPS hoặc localhost và trình duyệt hỗ trợ.',
  notifyDenied: 'Thông báo bị chặn. Hãy cấp quyền trong cài đặt trang của trình duyệt.',
  controls: 'Tuỳ chọn ván đấu',

  central: 'Bàn chung',
  centralHint: 'Mỗi lượt lấy trọn một ô.',
  takeSpace: (tokens) => `Lấy ${tokens.join(', ')}`,
  emptySpace: 'Ô trống',

  river: 'Thẻ thú',
  takeCard: 'Lấy thẻ',
  cardTaken: 'Bạn đã lấy một thẻ trong lượt này.',
  noRoomForCard: 'Hết chỗ cho thẻ mới: hãy hoàn thành một thẻ đang dở.',
  howToRead: 'Cách đọc thẻ',
  howToReadBody:
    'Mỗi thẻ vẽ đúng các chồng token mà con thú cần; con số là chiều cao của chồng. Nhà là một token đỏ đặt trên token xám, nâu hoặc đỏ. Khối gỗ đánh dấu ô đặt thú.',

  yourBoard: 'Bàn của bạn',
  boardOf: (name) => `Bàn của ${name}`,
  points: 'điểm',
  noCards: 'Bạn chưa có thẻ thú nào. Hãy lấy một thẻ trong hàng thẻ đang mở.',
  placeAnimal: 'Đặt thú',
  cancel: 'Thôi',
  completed: (count) => `${count} thẻ đã hoàn thành`,
  cardPoints: 'Điểm theo số thú đã đặt',
  animalsLeft: (count) => `còn ${count} thú`,

  cellEmpty: 'ô trống',
  cellHeight: (height) => `cao ${height}`,
  placeOn: (what) => `Đặt lên ${what}`,
  justPlayed: 'vừa đặt',
  habitat: (slot, around) => `Thú ở ${slot}, cạnh ${around.join(' và ')}`,
  habitatCell: (cell) => {
    switch (cell.terrain) {
      case 'WATER':
        return 'nước';
      case 'FIELD':
        return 'cánh đồng';
      case 'MOUNTAIN':
        return `núi cao ${cell.height}`;
      case 'TREE':
        return `cây cao ${cell.height}`;
      case 'BUILDING':
        return 'nhà (token đỏ trên token xám, nâu hoặc đỏ)';
    }
  },

  scores: 'Bảng điểm',
  player: 'Người chơi',
  you: 'bạn',
  score: {
    trees: 'Cây',
    mountains: 'Núi',
    fields: 'Cánh đồng',
    buildings: 'Nhà',
    water: 'Nước',
    animals: 'Thú',
    total: 'Tổng',
  },

  guide: {
    title: 'Cách tính điểm',
    openCard: 'Mở thẻ ở kích thước đầy đủ',
    cardAlt: {
      river: 'Thẻ tính điểm minh hoạ cho mặt sông: cùng luật với bảng bên cạnh.',
      islands: 'Thẻ tính điểm minh hoạ cho mặt đảo: cùng luật với bảng bên cạnh.',
    },
    trees: 'Cây',
    treeCount: (leaves, trunks) => `${leaves} lá, ${trunks} thân`,
    trunksOnly: 'Thân cây chưa có lá',
    trunksOnlyNote: 'chưa có lá',
    leavesAlone: 'Lá đứng một mình',
    leavesOnOne: 'Lá trên một thân',
    leavesOnTwo: 'Lá trên hai thân',
    mountains: 'Núi',
    mountainAlone: 'Núi không có núi nào bên cạnh',
    mountainAloneNote: 'đứng một mình',
    mountainNext: (height) => `Núi cao ${height} cạnh một núi khác`,
    mountainNextNote: 'mỗi núi, khi cạnh núi khác',
    fields: 'Cánh đồng',
    fieldAlone: 'Một ô cánh đồng lẻ',
    fieldAloneNote: 'đứng một mình',
    fieldGroup: 'Hai ô cánh đồng trở lên chạm nhau',
    fieldGroupNote: 'mỗi cụm từ 2 ô',
    buildings: 'Nhà',
    buildingStack: 'Token đỏ trên token xám, nâu hoặc đỏ',
    buildingFew: (colours) => `quanh nó ít hơn ${colours} màu`,
    buildingSurrounded: 'Nhà có từ ba màu trở lên bao quanh',
    buildingEnough: (colours) => `quanh nó từ ${colours} màu khác nhau`,
    buildingNote:
      'Nhà là một token đỏ đặt trên token xám, nâu hoặc đỏ. Token đỏ nằm trên mặt đất chưa phải là nhà.',
    water: 'Nước',
    riverLong: (length) => `dài ${length}`,
    riverNote: (longest, extra) =>
      `Chỉ con sông dài nhất của bạn được tính, đo giữa hai đầu xa nhau nhất. Mỗi ô vượt quá ${longest} cộng thêm ${extra}.`,
    island: 'Hai vùng đất có nước ngăn giữa',
    islandEach: 'mỗi đảo',
    islandNote:
      'Đảo là một vùng ô, đã xây hay còn trống, bị nước và mép bàn tách khỏi phần còn lại. Bàn không có nước là một đảo.',
    stacking: (pouch) =>
      `Xếp chồng: nước và cánh đồng luôn nằm sát đất. Núi cao tối đa 3. Thân cây cao tối đa 2 và được đóng lại bằng lá. Không đặt được gì lên ô đang có thú. Túi lúc đầu có ${pouch}.`,
    credit:
      'Biểu tượng: Lorc, Delapouite, Caro Asercion, Skoll, Faithtoken, Seregacthtuf và các tác giả khác',
  },
};

const en: HarmoniesText = {
  token: {
    water: 'Water',
    mountain: 'Mountain',
    trunk: 'Trunk',
    leaf: 'Leaves',
    field: 'Field',
    building: 'Building',
  },
  alerts: {
    title: 'Harmonies — Your turn',
    body: 'Come back to the game to pick your tokens and build your habitats.',
  },

  yourTurn: 'Your turn',
  turnOf: (name) => `${name}’s turn`,
  gameOver: 'Game over',
  finalRound: 'Final round',
  turnNumber: (turn) => `Turn ${turn}`,
  pouch: (count) => `${count} tokens in the pouch`,
  deck: (count) => `${count} cards in the deck`,

  status: {
    over: 'The game is over.',
    bot: 'The bot is playing for you.',
    waiting: (name) => `${name} is picking tokens.`,
    holding: (name) => `${name} is placing:`,
    pickCell: 'Pick a highlighted cell on your board.',
    pickAnimalCell: 'Pick a highlighted cell for the animal.',
    take: 'Take three tokens from one space of the central board.',
    place: 'Pick a token, then a cell on your board.',
    extras: 'Take a card, place an animal, or end your turn.',
  },
  steps: ['Take tokens', 'Place tokens', 'Cards and animals'],
  stepsLabel: 'Steps of the turn',
  endTurn: 'End turn',

  botOn: 'Let the bot play',
  botOff: 'Take back control',
  botPending: 'Handing over…',
  botNote: 'The bot is playing for you (normal level) until you turn it off.',
  soundOn: 'Sound: On',
  soundOff: 'Sound: Off',
  notifyOn: 'Turn on notifications',
  notifyOff: 'Turn off notifications',
  notifyRequesting: 'Asking permission…',
  notifyHint: 'Notifies you when the game tab is in the background.',
  notifyUnsupported: 'Notifications need HTTPS or localhost and a browser that supports them.',
  notifyDenied: 'Notifications are blocked. Allow them in the browser’s site settings.',
  controls: 'Match options',

  central: 'Central board',
  centralHint: 'Take one whole space each turn.',
  takeSpace: (tokens) => `Take ${tokens.join(', ')}`,
  emptySpace: 'Empty space',

  river: 'Animal cards',
  takeCard: 'Take',
  cardTaken: 'You already took a card this turn.',
  noRoomForCard: 'No room for another card: finish one you have first.',
  howToRead: 'How to read a card',
  howToReadBody:
    'Each card shows the exact stacks its animal needs; the number is the stack’s height. A building is a red token on top of a grey, brown or red one. The wooden cube marks where the animal goes.',

  yourBoard: 'Your board',
  boardOf: (name) => `${name}’s board`,
  points: 'pts',
  noCards: 'You have no animal cards yet. Take one from the cards on offer.',
  placeAnimal: 'Place animal',
  cancel: 'Cancel',
  completed: (count) => `${count} completed ${count === 1 ? 'card' : 'cards'}`,
  cardPoints: 'Points by number of animals placed',
  animalsLeft: (count) => `${count} ${count === 1 ? 'animal' : 'animals'} left`,

  cellEmpty: 'empty cell',
  cellHeight: (height) => `${height} high`,
  placeOn: (what) => `Place on ${what}`,
  justPlayed: 'just placed',
  habitat: (slot, around) => `Animal on ${slot}, next to ${around.join(' and ')}`,
  habitatCell: (cell) => {
    switch (cell.terrain) {
      case 'WATER':
        return 'water';
      case 'FIELD':
        return 'a field';
      case 'MOUNTAIN':
        return `a mountain ${cell.height} high`;
      case 'TREE':
        return `a tree ${cell.height} high`;
      case 'BUILDING':
        return 'a building (a red token on a grey, brown or red one)';
    }
  },

  scores: 'Scores',
  player: 'Player',
  you: 'you',
  score: {
    trees: 'Trees',
    mountains: 'Mountains',
    fields: 'Fields',
    buildings: 'Buildings',
    water: 'Water',
    animals: 'Animals',
    total: 'Total',
  },

  guide: {
    title: 'Scoring guide',
    openCard: 'Open the card at full size',
    cardAlt: {
      river: 'Illustrated scoring card for the river side: the same rules as the table beside it.',
      islands:
        'Illustrated scoring card for the island side: the same rules as the table beside it.',
    },
    trees: 'Trees',
    treeCount: (leaves, trunks) => `${leaves} leaves, ${trunks} trunks`,
    trunksOnly: 'Trunks with no leaves',
    trunksOnlyNote: 'no leaves yet',
    leavesAlone: 'Leaves alone',
    leavesOnOne: 'Leaves on one trunk',
    leavesOnTwo: 'Leaves on two trunks',
    mountains: 'Mountains',
    mountainAlone: 'A mountain with no mountain next to it',
    mountainAloneNote: 'standing alone',
    mountainNext: (height) => `A mountain ${height} high next to another mountain`,
    mountainNextNote: 'each, when next to another',
    fields: 'Fields',
    fieldAlone: 'A single field',
    fieldAloneNote: 'standing alone',
    fieldGroup: 'Two or more fields touching',
    fieldGroupNote: 'per group of 2 or more',
    buildings: 'Buildings',
    buildingStack: 'A red token on a grey, brown or red token',
    buildingFew: (colours) => `fewer than ${colours} colours around it`,
    buildingSurrounded: 'A building surrounded by three or more colours',
    buildingEnough: (colours) => `${colours}+ different colours around it`,
    buildingNote:
      'A building is a red token on top of a grey, brown or red one. A red token on the ground is not a building yet.',
    water: 'Water',
    riverLong: (length) => `${length} long`,
    riverNote: (longest, extra) =>
      `Only your longest river scores, measured between its two furthest ends. Each cell beyond ${longest} adds ${extra}.`,
    island: 'Two areas of land with water between them',
    islandEach: 'per island',
    islandNote:
      'An island is an area of cells, built on or empty, that water and the edge of the board cut off from the rest. A board with no water is one island.',
    stacking: (pouch) =>
      `Stacking: water and fields stay flat. Mountains go up to 3. Trunks go up to 2 and are closed by leaves. Nothing can be placed on a cell that holds an animal. The pouch started with ${pouch}.`,
    credit: 'Icons: Lorc, Delapouite, Caro Asercion, Skoll, Faithtoken, Seregacthtuf and others',
  },
};

export const HARMONIES_TEXT: Record<Locale, HarmoniesText> = { vi, en };
