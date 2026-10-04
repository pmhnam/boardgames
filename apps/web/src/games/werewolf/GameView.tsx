import {
  ROLE_IDS,
  isWolf,
  type MyView,
  type WerewolfAction,
  type WerewolfView,
} from '@bgp/game-werewolf';
import { useEffect, useState, type ReactNode } from 'react';
import { playerName, type GameViewProps } from '../types';
import { EventLog } from './components/EventLog';
import { PlayerGrid, type PlayerTile } from './components/PlayerGrid';
import { RoleCard } from './components/RoleCard';
import { ROLE_LABEL, WINNER_LABEL } from './labels';

const PHASE_TITLE: Record<WerewolfView['phase'], string> = {
  NIGHT: 'Đêm',
  DAY_DISCUSSION: 'Ngày: thảo luận',
  DAY_VOTE: 'Ngày: bỏ phiếu',
  HUNTER_SHOT: 'Phát súng cuối',
  FINISHED: 'Kết thúc',
};

/** What the viewer is asked to do, and what the button that does it says. */
const PROMPT: Partial<Record<WerewolfAction['type'], { ask: string; confirm: string }>> = {
  CUPID_LINK: { ask: 'Chọn hai người để ghép thành cặp đôi.', confirm: 'Ghép đôi' },
  WOLF_VOTE: { ask: 'Chọn người để bầy sói cắn đêm nay.', confirm: 'Cắn' },
  SEER_INSPECT: { ask: 'Chọn một người để soi.', confirm: 'Soi' },
  GUARD_PROTECT: { ask: 'Chọn một người để bảo vệ đêm nay.', confirm: 'Bảo vệ' },
  CAST_VOTE: { ask: 'Chọn người bạn muốn treo.', confirm: 'Bỏ phiếu treo' },
  HUNTER_SHOOT: { ask: 'Bạn đã chết. Chọn một người để bắn theo.', confirm: 'Bắn' },
};

/** What someone with nothing to do right now is told. */
function describeWaiting(view: WerewolfView, me: MyView | null, nameOf: (id: string) => string) {
  if (view.phase === 'HUNTER_SHOT' && view.shooterId) {
    return `Thợ săn ${nameOf(view.shooterId)} đang chọn người để bắn.`;
  }
  if (!me) return 'Bạn đang xem ván này.';
  if (!me.alive) return 'Bạn đã chết. Hãy giữ im lặng và theo dõi.';
  if (view.phase === 'NIGHT') return 'Bạn đã xong. Đang chờ những người khác…';
  if (view.phase === 'DAY_DISCUSSION') return 'Bạn đã sẵn sàng. Đang chờ những người khác…';
  if (view.phase === 'DAY_VOTE') {
    return view.players.find((player) => player.playerId === me.playerId)?.canVote
      ? 'Bạn đã bỏ phiếu. Đang chờ những người khác…'
      : 'Bạn không còn quyền bỏ phiếu.';
  }
  return '';
}

export function WerewolfGameView({
  message,
  players,
  sendAction,
  disabled,
}: GameViewProps<WerewolfView, WerewolfAction>) {
  const view = message.state;
  const me = view.me;
  const legal = me?.legal;
  const action = disabled ? null : (legal?.action ?? null);
  const over = view.phase === 'FINISHED';
  const nameOf = (playerId: string) => playerName(players, playerId);

  // Local UI state only: what is picked but not yet sent, and whether secrets are on screen.
  const [picked, setPicked] = useState<string[]>([]);
  const [heal, setHeal] = useState(false);
  const [secretsShown, setSecretsShown] = useState(false);
  // Other players acting bumps the version constantly; a pick is only dropped when what
  // the viewer is being asked changes.
  const question = `${view.round}:${view.phase}:${legal?.action ?? ''}`;
  useEffect(() => {
    setPicked([]);
    setHeal(false);
  }, [question]);

  const wanted = action === 'CUPID_LINK' ? 2 : 1;
  const pick = (playerId: string) =>
    setPicked((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId].slice(-wanted),
    );
  const [first, second] = picked;

  const alive = view.players.filter((player) => player.alive);
  const packVotes = action === 'WOLF_VOTE' || secretsShown ? (me?.packVotes ?? []) : [];

  const tiles: PlayerTile[] = view.players.map((player) => {
    const { playerId } = player;
    const marks: ReactNode[] = [];
    const mark = (key: string, text: string) => marks.push(<span key={key}>{text}</span>);
    if (view.phase === 'DAY_DISCUSSION' && view.ready.includes(playerId)) mark('ready', 'Sẵn sàng');
    if (view.phase === 'DAY_VOTE' && view.voted.includes(playerId)) mark('voted', 'Đã bỏ phiếu');
    if (player.alive && !player.canVote) mark('mute', 'Mất quyền bỏ phiếu');
    if (view.shooterId === playerId) mark('shooter', 'Đang ngắm bắn');
    if ((secretsShown || over) && view.lovers?.includes(playerId)) mark('lover', '❤ Cặp đôi');
    if (over && view.winnerPlayerIds.includes(playerId)) mark('winner', '🏆 Thắng');
    const hunters = packVotes.filter((vote) => vote.targetId === playerId);
    if (hunters.length > 0) {
      mark('pack', `Sói chọn: ${hunters.map((vote) => nameOf(vote.wolfId)).join(', ')}`);
    }
    return {
      player,
      name: nameOf(playerId),
      isYou: playerId === me?.playerId,
      // A role the table has not been shown stays off the screen until the viewer asks.
      role: player.revealed || secretsShown ? player.role : null,
      marks,
      selectable: action !== null && (legal?.targets.includes(playerId) ?? false),
      selected: picked.includes(playerId),
    };
  });

  const prompt = action ? PROMPT[action] : undefined;
  const cast = ROLE_IDS.filter((role) => view.roleCounts[role] > 0);

  return (
    <div className={`stack werewolf ${view.phase === 'NIGHT' ? 'night' : 'day'}`}>
      <header className="card werewolf-banner">
        <strong>
          {over && view.winner ? WINNER_LABEL[view.winner] : PHASE_TITLE[view.phase]}
          {!over && <span className="muted"> · vòng {view.round}</span>}
        </strong>
        <span className="muted">
          Còn sống {alive.length}/{view.players.length}
          {view.phase === 'DAY_DISCUSSION' &&
            ` · sẵn sàng ${view.ready.length} (cần hơn ${Math.floor(alive.length / 2)})`}
          {view.phase === 'DAY_VOTE' &&
            ` · đã bỏ phiếu ${view.voted.length}/${alive.filter((player) => player.canVote).length}`}
        </span>
      </header>

      <div className="werewolf-table">
        <section className="card" aria-label="Bàn chơi">
          <PlayerGrid tiles={tiles} onPick={pick} />

          {!over && (
            <div className="stack-small werewolf-action">
              {action === null && (
                <span className="muted">{describeWaiting(view, me, nameOf)}</span>
              )}

              {action === 'SLEEP' && (
                <>
                  <span>Đêm nay bạn không có việc gì. Bấm để đi ngủ.</span>
                  <div className="row">
                    <button type="button" onClick={() => sendAction({ type: 'SLEEP' })}>
                      Đi ngủ
                    </button>
                  </div>
                </>
              )}

              {action === 'READY_TO_VOTE' && (
                <>
                  <span>Thảo luận với mọi người, rồi bấm khi bạn muốn chuyển sang bỏ phiếu.</span>
                  <div className="row">
                    <button type="button" onClick={() => sendAction({ type: 'READY_TO_VOTE' })}>
                      Sẵn sàng bỏ phiếu
                    </button>
                  </div>
                </>
              )}

              {action === 'WITCH_DECIDE' && me && (
                <>
                  <span>
                    {me.attackedId
                      ? `Đêm nay ${nameOf(me.attackedId)} bị Sói cắn.`
                      : me.potions?.heal
                        ? 'Đêm nay không ai bị Sói cắn.'
                        : 'Bạn đã hết bình cứu nên không biết ai bị cắn.'}
                    {legal && legal.targets.length > 0 && ' Chọn một người nếu muốn dùng bình độc.'}
                  </span>
                  {legal?.canHeal && (
                    <label className="row">
                      <input
                        type="checkbox"
                        checked={heal}
                        onChange={(event) => setHeal(event.target.checked)}
                      />
                      <span>Dùng bình cứu</span>
                    </label>
                  )}
                  <div className="row">
                    <button
                      type="button"
                      onClick={() =>
                        sendAction({ type: 'WITCH_DECIDE', heal, poisonTargetId: first ?? null })
                      }
                    >
                      {first ? `Xác nhận, đầu độc ${nameOf(first)}` : 'Xác nhận'}
                    </button>
                  </div>
                </>
              )}

              {action === 'CUPID_LINK' && prompt && (
                <>
                  <span>{prompt.ask}</span>
                  <div className="row">
                    <button
                      type="button"
                      disabled={!first || !second}
                      onClick={() =>
                        first &&
                        second &&
                        sendAction({ type: 'CUPID_LINK', firstId: first, secondId: second })
                      }
                    >
                      {first && second
                        ? `${prompt.confirm} ${nameOf(first)} ❤ ${nameOf(second)}`
                        : prompt.confirm}
                    </button>
                  </div>
                </>
              )}

              {(action === 'WOLF_VOTE' ||
                action === 'SEER_INSPECT' ||
                action === 'GUARD_PROTECT' ||
                action === 'CAST_VOTE' ||
                action === 'HUNTER_SHOOT') &&
                prompt && (
                  <>
                    <span>{prompt.ask}</span>
                    <div className="row wrap">
                      <button
                        type="button"
                        disabled={!first}
                        onClick={() => first && sendAction({ type: action, targetId: first })}
                      >
                        {first ? `${prompt.confirm} ${nameOf(first)}` : prompt.confirm}
                      </button>
                      {legal?.canSkip && (action === 'CAST_VOTE' || action === 'HUNTER_SHOOT') && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => sendAction({ type: action, targetId: null })}
                        >
                          {action === 'CAST_VOTE' ? 'Không treo ai' : 'Không bắn'}
                        </button>
                      )}
                    </div>
                  </>
                )}
            </div>
          )}
        </section>

        <aside className="stack werewolf-side">
          {me && !over && (
            <RoleCard
              view={view}
              me={me}
              shown={secretsShown}
              onToggle={() => setSecretsShown((shown) => !shown)}
              nameOf={nameOf}
            />
          )}
          <section className="card" aria-label="Bộ vai">
            <h2>Bộ vai của ván</h2>
            <ul className="werewolf-cast">
              {cast.map((role) => (
                <li key={role} className={isWolf(role) ? 'wolf' : undefined}>
                  <span>{ROLE_LABEL[role]}</span>
                  <span className="num">×{view.roleCounts[role]}</span>
                </li>
              ))}
            </ul>
            <span className="muted hint">
              {view.revealRoleOnDeath ? 'Vai được lật khi chết.' : 'Vai chỉ lật khi hết ván.'}
            </span>
          </section>
          <EventLog log={view.log} nameOf={nameOf} />
        </aside>
      </div>
    </div>
  );
}
