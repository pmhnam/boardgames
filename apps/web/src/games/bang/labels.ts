import type { CardKind, CardView, CharacterId, RoleId, Suit, Winner } from '@bgp/game-bang';

export const CARD_LABEL: Record<CardKind, string> = {
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

export const CARD_HINT: Record<CardKind, string> = {
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
  volcanic: 'Súng tầm 1. Được đánh bao nhiêu lá BANG! cũng được.',
  schofield: 'Súng tầm 2.',
  remington: 'Súng tầm 3.',
  revCarabine: 'Súng tầm 4.',
  winchester: 'Súng tầm 5.',
};

export const CHARACTER_LABEL: Record<CharacterId, string> = {
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

export const CHARACTER_HINT: Record<CharacterId, string> = {
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
};

export const ROLE_LABEL: Record<RoleId, string> = {
  sheriff: 'Cảnh sát trưởng',
  deputy: 'Phó cảnh sát',
  outlaw: 'Tội phạm',
  renegade: 'Kẻ phản bội',
};

export const ROLE_GOAL: Record<RoleId, string> = {
  sheriff: 'Loại hết Tội phạm và Kẻ phản bội.',
  deputy: 'Bảo vệ Cảnh sát trưởng: loại hết Tội phạm và Kẻ phản bội.',
  outlaw: 'Hạ Cảnh sát trưởng.',
  renegade: 'Là người cuối cùng sống sót: hạ Cảnh sát trưởng sau cùng.',
};

export const WINNER_LABEL: Record<Winner, string> = {
  law: 'Phe luật pháp thắng',
  outlaws: 'Tội phạm thắng',
  renegade: 'Kẻ phản bội thắng',
};

const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const FACE_RANK: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

/** A card's suit and rank as printed in its corner, e.g. "Q♥". */
export function pipLabel(card: Pick<CardView, 'suit' | 'rank'>): string {
  return `${FACE_RANK[card.rank] ?? card.rank}${SUIT_SYMBOL[card.suit]}`;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}
