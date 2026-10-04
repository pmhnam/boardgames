import type { MyView, WerewolfView } from '@bgp/game-werewolf';
import { ROLE_HINT, ROLE_LABEL } from '../labels';

/**
 * The viewer's own secrets. Hidden until asked for: people play this sitting next to each
 * other, and a glance at a neighbour's screen should give nothing away.
 */
export function RoleCard({
  view,
  me,
  shown,
  onToggle,
  nameOf,
}: {
  view: WerewolfView;
  me: MyView;
  shown: boolean;
  onToggle(): void;
  nameOf(playerId: string): string;
}) {
  const loverId = view.lovers?.find((playerId) => playerId !== me.playerId);
  const inCouple = view.lovers?.includes(me.playerId) === true;

  return (
    <section className="card werewolf-role" aria-label="Vai của bạn">
      <div className="row werewolf-role-head">
        <h2>Vai của bạn</h2>
        <button type="button" className="secondary" aria-pressed={shown} onClick={onToggle}>
          {shown ? 'Ẩn' : 'Xem vai'}
        </button>
      </div>
      {shown ? (
        <div className="stack-small">
          <strong>{ROLE_LABEL[me.role]}</strong>
          <span className="muted">{ROLE_HINT[me.role]}</span>
          {me.potions && (
            <span>
              Bình cứu: {me.potions.heal ? 'còn' : 'đã dùng'} · Bình độc:{' '}
              {me.potions.poison ? 'còn' : 'đã dùng'}
            </span>
          )}
          {me.lastProtectedId && <span>Đêm trước bạn bảo vệ {nameOf(me.lastProtectedId)}.</span>}
          {me.inspections.map((seen) => (
            <span key={`${seen.round}-${seen.targetId}`}>
              Đêm {seen.round}: {nameOf(seen.targetId)} {seen.isWolf ? 'là Sói' : 'không phải Sói'}
            </span>
          ))}
          {view.lovers && inCouple && loverId && <span>Người yêu của bạn: {nameOf(loverId)}</span>}
          {view.lovers && !inCouple && (
            <span>Cặp đôi bạn ghép: {view.lovers.map(nameOf).join(' ❤ ')}</span>
          )}
        </div>
      ) : (
        <span className="muted">Đang ẩn. Chỉ mở khi không ai nhìn màn hình của bạn.</span>
      )}
    </section>
  );
}
