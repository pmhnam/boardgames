import {
  SPECIAL_ROLE_IDS,
  type CompositionCode,
  type RoleCounts,
  type RoleId,
  type Winner,
} from '@bgp/game-werewolf';

export const ROLE_LABEL: Record<RoleId, string> = {
  villager: 'Dân làng',
  werewolf: 'Sói',
  alphaWerewolf: 'Sói đầu đàn',
  seer: 'Tiên tri',
  bodyguard: 'Bảo vệ',
  witch: 'Phù thủy',
  hunter: 'Thợ săn',
  cupid: 'Cupid',
  elder: 'Già làng',
  idiot: 'Thằng ngốc',
};

export const ROLE_HINT: Record<RoleId, string> = {
  villager: 'Không có năng lực. Tìm ra Sói bằng lời nói và lá phiếu.',
  werewolf: 'Mỗi đêm cùng bầy chọn một người để cắn.',
  alphaWerewolf: 'Như Sói, nhưng phiếu cắn của bạn nặng hơn.',
  seer: 'Mỗi đêm soi một người: là Sói hay không.',
  bodyguard: 'Mỗi đêm bảo vệ một người, không trùng đêm trước.',
  witch: 'Một bình cứu, một bình độc, mỗi bình dùng một lần.',
  hunter: 'Khi chết được bắn theo một người.',
  cupid: 'Đêm đầu ghép một cặp đôi: một người chết, người kia chết theo.',
  elder: 'Sống sót lần đầu bị Sói cắn. Bị làng treo thì làng mất hết năng lực.',
  idiot: 'Bị làng treo lần đầu thì được tha, nhưng mất quyền bỏ phiếu.',
};

export const WINNER_LABEL: Record<Winner, string> = {
  village: 'Phe Dân thắng',
  werewolves: 'Phe Sói thắng',
  lovers: 'Cặp đôi thắng',
  nobody: 'Không ai sống sót',
};

/** Why a cast cannot be played, in the host's words. The engine decides; this only translates. */
export const COMPOSITION_ERROR: Record<CompositionCode, string> = {
  INVALID_PLAYER_COUNT: 'Ma Sói cần từ 5 đến 16 người.',
  ROLE_DISABLED: 'Có vai đang bị tắt trong cấu hình.',
  ROLE_OVER_LIMIT: 'Có vai vượt quá số lượng cho phép.',
  NO_WEREWOLF: 'Cần ít nhất một Sói.',
  TOO_MANY_ROLES: 'Số vai nhiều hơn số người chơi.',
  TOO_MANY_WEREWOLVES: 'Sói phải ít hơn một nửa số người chơi.',
};

/** A cast on one line, e.g. "2 Sói · Tiên tri · 4 Dân làng". */
export function describeCast(roles: Partial<RoleCounts>): string {
  // Villagers last: they are whoever is left over.
  const order: RoleId[] = [...SPECIAL_ROLE_IDS, 'villager'];
  return order
    .flatMap((role) => {
      const count = roles[role] ?? 0;
      if (count === 0) return [];
      return count === 1 ? ROLE_LABEL[role] : `${count} ${ROLE_LABEL[role]}`;
    })
    .join(' · ');
}
