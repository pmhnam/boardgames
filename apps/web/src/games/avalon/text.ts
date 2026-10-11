import type { Alignment, AvalonPhase, OutcomeReason, Role, Sighting } from '@bgp/game-avalon';
import type { Locale } from '../../shared/i18n/locales';

/** Everything the Avalon table says, in one language. */
export interface AvalonText {
  alerts: { title: string; body: string };
  tools: {
    label: string;
    soundOn: string;
    soundOff: string;
    notifyOn: string;
    notifyOff: string;
    notifyRequesting: string;
    notifyHint: string;
    notifyDenied: string;
    notifyUnsupported: string;
  };
  questOf(number: number, total: number): string;
  watching: string;
  /** The phase in a word or two, over the table. */
  phase: Record<AvalonPhase, string>;
  status: {
    youLead(size: number): string;
    leading(leader: string, size: number): string;
    voteNow(leader: string): string;
    youVoted(approved: boolean): string;
    waitingVotes(count: number): string;
    questNow: string;
    youPlayed: string;
    waitingCards(count: number): string;
    ladyYours: string;
    ladyOf(holder: string): string;
    assassinYours: string;
    assassinOf(assassin: string): string;
  };
  outcome: Record<OutcomeReason, string>;
  named(assassin: string, target: string): string;
  role: Record<Role, string>;
  roleBlurb: Record<Role, string>;
  alignment: Record<Alignment, string>;
  sighting: Record<Sighting, string>;
  seat: {
    you: string;
    leader: string;
    onTeam: string;
    lady: string;
    assassinated: string;
    winner: string;
    voting: string;
    voted: string;
    choosing: string;
    played: string;
    lastVote(approved: boolean): string;
    ladyShowed(alignment: Alignment): string;
  };
  quest: {
    trackLabel: string;
    label(number: number): string;
    players(size: number): string;
    failsNeeded(count: number): string;
    success: string;
    failed: string;
    fails(count: number): string;
    rejections: string;
    rejectionsOf(count: number, max: number): string;
  };
  table: string;
  prompt: {
    proposeTitle(size: number): string;
    proposeHint: string;
    propose(picked: number, size: number): string;
    voteTitle: string;
    approve: string;
    reject: string;
    voteHint: string;
    questTitle: string;
    success: string;
    fail: string;
    questHintEvil: string;
    questHintGood: string;
    ladyTitle: string;
    ladyHint: string;
    look(name: string): string;
    assassinTitle: string;
    assassinHint: string;
    assassinate(name: string): string;
    pickPlayer: string;
  };
  you: {
    title: string;
    show: string;
    hide: string;
    faceDown: string;
    ladyShowed(name: string, alignment: Alignment): string;
  };
  cast: { title: string; goal(maxRejections: number): string };
  lady: {
    title: string;
    heldBy(name: string): string;
    lastHeldBy(name: string): string;
    looked(holder: string, target: string): string;
  };
  history: {
    title: string;
    quest: string;
    leader: string;
    result: string;
    sent: string;
    rejected: string;
    approved: string;
    rejectedVote: string;
    onTeam: string;
    legend: string;
  };
  credit: string;
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

const vi: AvalonText = {
  alerts: {
    title: 'Avalon — Đến lượt bạn',
    body: 'Quay lại bàn: mọi người đang chờ bạn chọn đội, bỏ phiếu hoặc ra lá nhiệm vụ.',
  },
  tools: {
    label: 'Âm báo và thông báo',
    soundOn: 'Âm báo: bật',
    soundOff: 'Âm báo: tắt',
    notifyOn: 'Bật thông báo',
    notifyOff: 'Tắt thông báo',
    notifyRequesting: 'Đang xin quyền…',
    notifyHint: 'Báo trên màn hình khi tới lượt bạn mà bạn đang ở tab khác.',
    notifyDenied: 'Trình duyệt đang chặn thông báo của trang này.',
    notifyUnsupported: 'Trình duyệt này không hỗ trợ thông báo.',
  },
  questOf: (number, total) => `Nhiệm vụ ${number}/${total}`,
  watching: 'Bạn đang xem trận này.',
  phase: {
    TEAM_PROPOSAL: 'Chọn đội',
    TEAM_VOTE: 'Bỏ phiếu',
    QUEST: 'Làm nhiệm vụ',
    LADY: 'Hồ Nữ Thần',
    ASSASSINATION: 'Ám sát Merlin',
    FINISHED: 'Kết thúc',
  },
  status: {
    youLead: (size) => `Bạn là đội trưởng: chọn ${size} người đi làm nhiệm vụ.`,
    leading: (leader, size) => `${leader} đang chọn đội ${size} người.`,
    voteNow: (leader) => `${leader} đề cử đội này. Bạn tán thành hay phản đối?`,
    youVoted: (approved) => `Bạn đã ${approved ? 'tán thành' : 'phản đối'}.`,
    waitingVotes: (count) => `Còn chờ ${count} phiếu.`,
    questNow: 'Đội đã được duyệt và bạn có trong đội: hãy ra một lá.',
    youPlayed: 'Bạn đã ra lá.',
    waitingCards: (count) => `Đội đang làm nhiệm vụ, còn chờ ${count} lá.`,
    ladyYours: 'Bạn giữ Hồ Nữ Thần: chọn một người để xem phe.',
    ladyOf: (holder) => `${holder} đang dùng Hồ Nữ Thần.`,
    assassinYours: 'Phe thiện đã thắng ba nhiệm vụ. Bạn là Sát thủ: hãy chỉ ra Merlin.',
    assassinOf: (assassin) => `${assassin} là Sát thủ và đang tìm Merlin.`,
  },
  outcome: {
    QUESTS_FAILED: 'Phe ác thắng: ba nhiệm vụ thất bại.',
    TEAMS_REJECTED: 'Phe ác thắng: cả bàn không thống nhất được một đội.',
    MERLIN_ASSASSINATED: 'Phe ác thắng: Sát thủ đã tìm ra Merlin.',
    MERLIN_SURVIVED: 'Phe thiện thắng: ba nhiệm vụ thành công và Merlin an toàn.',
  },
  named: (assassin, target) => `${assassin} đã chỉ ${target} là Merlin.`,
  role: {
    MERLIN: 'Merlin',
    PERCIVAL: 'Percival',
    LOYAL_SERVANT: 'Cận thần trung thành',
    ASSASSIN: 'Sát thủ',
    MORGANA: 'Morgana',
    MORDRED: 'Mordred',
    OBERON: 'Oberon',
    MINION: 'Tay sai của Mordred',
  },
  roleBlurb: {
    MERLIN:
      'Bạn biết ai thuộc phe ác. Dẫn dắt phe thiện mà đừng để lộ: nếu cuối ván Sát thủ chỉ đúng bạn, phe ác thắng.',
    PERCIVAL: 'Bạn biết Merlin là ai. Đừng để Sát thủ đoán ra.',
    LOYAL_SERVANT: 'Bạn không biết ai cả. Hãy tìm ra người đáng tin và cử đội tốt.',
    ASSASSIN: 'Nếu phe thiện thắng ba nhiệm vụ, bạn chỉ ra Merlin. Chỉ đúng thì phe ác vẫn thắng.',
    MORGANA: 'Percival thấy bạn giống hệt Merlin và không phân biệt được.',
    MORDRED: 'Merlin không biết bạn thuộc phe ác.',
    OBERON: 'Bạn không biết đồng bọn, và đồng bọn cũng không biết bạn.',
    MINION: 'Lọt vào đội và phá nhiệm vụ mà đừng để bị phát hiện.',
  },
  alignment: { GOOD: 'Phe thiện', EVIL: 'Phe ác' },
  sighting: { EVIL: 'Phe ác', MERLIN_OR_MORGANA: 'Merlin hoặc Morgana' },
  seat: {
    you: 'bạn',
    leader: 'Đội trưởng',
    onTeam: 'Trong đội',
    lady: 'Hồ Nữ Thần',
    assassinated: 'Bị ám sát',
    winner: 'Thắng',
    voting: 'Đang bỏ phiếu',
    voted: 'Đã bỏ phiếu',
    choosing: 'Đang chọn lá',
    played: 'Đã ra lá',
    lastVote: (approved) => (approved ? 'Đã tán thành' : 'Đã phản đối'),
    ladyShowed: (alignment) => `Hồ Nữ Thần cho thấy: ${alignment === 'GOOD' ? 'thiện' : 'ác'}`,
  },
  quest: {
    trackLabel: 'Năm nhiệm vụ',
    label: (number) => `Nhiệm vụ ${number}`,
    players: (size) => `${size} người`,
    failsNeeded: (count) => `cần ${count} lá hỏng`,
    success: 'Thành công',
    failed: 'Thất bại',
    fails: (count) => `${count} lá hỏng`,
    rejections: 'Số đội bị bác liên tiếp',
    rejectionsOf: (count, max) => `${count}/${max}`,
  },
  table: 'Bàn tròn',
  prompt: {
    proposeTitle: (size) => `Chọn đội ${size} người`,
    proposeHint: 'Bấm vào ghế trên bàn để chọn, có thể chọn chính mình. Sau đó cả bàn bỏ phiếu.',
    propose: (picked, size) => `Đề cử đội (${picked}/${size})`,
    voteTitle: 'Cử đội này đi làm nhiệm vụ?',
    approve: 'Tán thành',
    reject: 'Phản đối',
    voteHint: 'Phiếu chỉ được lật khi mọi người đã bỏ xong.',
    questTitle: 'Bạn đang làm nhiệm vụ: ra một lá',
    success: 'Thành công',
    fail: 'Phá hỏng',
    questHintEvil: 'Bàn chỉ biết có bao nhiêu lá hỏng, không biết ai ra.',
    questHintGood: 'Phe thiện luôn ra lá Thành công.',
    ladyTitle: 'Dùng Hồ Nữ Thần',
    ladyHint:
      'Bấm vào một ghế để biết người đó thuộc phe nào. Chỉ bạn thấy kết quả, và Hồ Nữ Thần chuyển sang người đó.',
    look: (name) => `Xem phe của ${name}`,
    assassinTitle: 'Chỉ ra Merlin',
    assassinHint: 'Bấm vào ghế của người bạn tin là Merlin. Chỉ đúng thì phe ác thắng.',
    assassinate: (name) => `Ám sát ${name}`,
    pickPlayer: 'Chọn một người',
  },
  you: {
    title: 'Vai của bạn',
    show: 'Hiện',
    hide: 'Úp xuống',
    faceDown: 'Đang úp. Dù úp hay ngửa thì cũng không ai khác thấy được.',
    ladyShowed: (name, alignment) =>
      `Hồ Nữ Thần cho bạn thấy: ${name} thuộc phe ${alignment === 'GOOD' ? 'thiện' : 'ác'}.`,
  },
  cast: {
    title: 'Các vai trong ván',
    goal: (maxRejections) =>
      `Phe thiện cần ba nhiệm vụ thành công và giữ kín Merlin. Phe ác cần ba nhiệm vụ thất bại, ${maxRejections} đội bị bác liên tiếp, hoặc chỉ đúng Merlin.`,
  },
  lady: {
    title: 'Hồ Nữ Thần',
    heldBy: (name) => `${name} đang giữ.`,
    lastHeldBy: (name) => `${name} giữ sau cùng.`,
    looked: (holder, target) => `${holder} đã xem ${target}`,
  },
  history: {
    title: 'Các lần bỏ phiếu',
    quest: 'Nhiệm vụ',
    leader: 'Đội trưởng',
    result: 'Kết quả',
    sent: 'Được cử đi',
    rejected: 'Bị bác',
    approved: 'tán thành',
    rejectedVote: 'phản đối',
    onTeam: 'trong đội',
    legend: 'Ô được tô đậm là người được chọn vào đội lần đó.',
  },
  credit: 'Biểu tượng: Lorc, Delapouite',
};

const en: AvalonText = {
  alerts: {
    title: 'Avalon — Your move',
    body: 'Back to the table: everyone is waiting for your team, your vote or your quest card.',
  },
  tools: {
    label: 'Chime and notifications',
    soundOn: 'Chime: on',
    soundOff: 'Chime: off',
    notifyOn: 'Turn on notifications',
    notifyOff: 'Turn off notifications',
    notifyRequesting: 'Asking…',
    notifyHint: 'Shows a notification when it is your move and you are on another tab.',
    notifyDenied: 'The browser is blocking notifications from this site.',
    notifyUnsupported: 'This browser has no notifications.',
  },
  questOf: (number, total) => `Quest ${number} of ${total}`,
  watching: 'You are watching this match.',
  phase: {
    TEAM_PROPOSAL: 'Choosing a team',
    TEAM_VOTE: 'Voting',
    QUEST: 'On the quest',
    LADY: 'Lady of the Lake',
    ASSASSINATION: 'The assassination',
    FINISHED: 'Game over',
  },
  status: {
    youLead: (size) => `You lead: choose ${size} players for the quest.`,
    leading: (leader, size) => `${leader} is choosing a team of ${size}.`,
    voteNow: (leader) => `${leader} proposes this team. Approve or reject?`,
    youVoted: (approved) => `You ${approved ? 'approved' : 'rejected'}.`,
    waitingVotes: (count) => `Waiting for ${count} more ${plural(count, 'vote', 'votes')}.`,
    questNow: 'The team is approved and you are on it: play a card.',
    youPlayed: 'You played your card.',
    waitingCards: (count) =>
      `The team is on the quest. Waiting for ${count} more ${plural(count, 'card', 'cards')}.`,
    ladyYours: 'You hold the Lady of the Lake: pick a player to learn their side.',
    ladyOf: (holder) => `${holder} is using the Lady of the Lake.`,
    assassinYours: 'Good has three quests. You are the Assassin: name Merlin.',
    assassinOf: (assassin) => `${assassin} is the Assassin, and is looking for Merlin.`,
  },
  outcome: {
    QUESTS_FAILED: 'Evil wins: three quests failed.',
    TEAMS_REJECTED: 'Evil wins: the table could not agree on a team.',
    MERLIN_ASSASSINATED: 'Evil wins: the Assassin found Merlin.',
    MERLIN_SURVIVED: 'Good wins: three quests succeeded and Merlin survived.',
  },
  named: (assassin, target) => `${assassin} named ${target} as Merlin.`,
  role: {
    MERLIN: 'Merlin',
    PERCIVAL: 'Percival',
    LOYAL_SERVANT: 'Loyal Servant',
    ASSASSIN: 'Assassin',
    MORGANA: 'Morgana',
    MORDRED: 'Mordred',
    OBERON: 'Oberon',
    MINION: 'Minion of Mordred',
  },
  roleBlurb: {
    MERLIN:
      'You know who is evil. Guide the good side without being found out: if the Assassin names you at the end, evil wins.',
    PERCIVAL: 'You know who Merlin is. Keep the Assassin from working it out.',
    LOYAL_SERVANT: 'You know nobody. Work out who to trust and send good teams.',
    ASSASSIN: 'If good wins three quests, you name Merlin. Get it right and evil wins after all.',
    MORGANA: 'Percival sees you as he sees Merlin, and cannot tell you apart.',
    MORDRED: 'Merlin does not know you are evil.',
    OBERON: 'You do not know the rest of evil, and they do not know you.',
    MINION: 'Get onto quests and fail them without being found out.',
  },
  alignment: { GOOD: 'Good', EVIL: 'Evil' },
  sighting: { EVIL: 'Evil', MERLIN_OR_MORGANA: 'Merlin or Morgana' },
  seat: {
    you: 'you',
    leader: 'Leader',
    onTeam: 'On the team',
    lady: 'Lady of the Lake',
    assassinated: 'Assassinated',
    winner: 'Won',
    voting: 'Voting…',
    voted: 'Voted',
    choosing: 'Choosing…',
    played: 'Card played',
    lastVote: (approved) => (approved ? 'Approved' : 'Rejected'),
    ladyShowed: (alignment) => `The Lady showed: ${alignment === 'GOOD' ? 'good' : 'evil'}`,
  },
  quest: {
    trackLabel: 'The five quests',
    label: (number) => `Quest ${number}`,
    players: (size) => `${size} ${plural(size, 'player', 'players')}`,
    failsNeeded: (count) => `${count} fails needed`,
    success: 'Success',
    failed: 'Failed',
    fails: (count) => `${count} ${plural(count, 'fail', 'fails')}`,
    rejections: 'Teams rejected in a row',
    rejectionsOf: (count, max) => `${count} of ${max}`,
  },
  table: 'The round table',
  prompt: {
    proposeTitle: (size) => `Choose a team of ${size}`,
    proposeHint: 'Pick seats at the table. You may pick yourself. Everyone then votes on it.',
    propose: (picked, size) => `Propose team (${picked}/${size})`,
    voteTitle: 'Send this team on the quest?',
    approve: 'Approve',
    reject: 'Reject',
    voteHint: 'Votes are shown once everyone has voted.',
    questTitle: 'You are on the quest: play a card',
    success: 'Success',
    fail: 'Fail',
    questHintEvil: 'Only the number of Fails is announced, never who played them.',
    questHintGood: 'The good side always plays Success.',
    ladyTitle: 'Use the Lady of the Lake',
    ladyHint:
      'Pick a seat to learn which side that player is on. Only you see the answer, and the Lady passes to them.',
    look: (name) => `Look at ${name}`,
    assassinTitle: 'Name Merlin',
    assassinHint: 'Pick the seat of the player you believe is Merlin. If you are right, evil wins.',
    assassinate: (name) => `Assassinate ${name}`,
    pickPlayer: 'Pick a player',
  },
  you: {
    title: 'Your role',
    show: 'Show',
    hide: 'Turn face down',
    faceDown: 'Face down. Nobody else can see it either way.',
    ladyShowed: (name, alignment) =>
      `The Lady showed you: ${name} is ${alignment === 'GOOD' ? 'good' : 'evil'}.`,
  },
  cast: {
    title: 'Roles in this game',
    goal: (maxRejections) =>
      `Good needs three successful quests, and Merlin to stay hidden. Evil needs three failed quests, ${maxRejections} teams rejected in a row, or Merlin’s name.`,
  },
  lady: {
    title: 'Lady of the Lake',
    heldBy: (name) => `Held by ${name}.`,
    lastHeldBy: (name) => `Last held by ${name}.`,
    looked: (holder, target) => `${holder} looked at ${target}`,
  },
  history: {
    title: 'Votes so far',
    quest: 'Quest',
    leader: 'Leader',
    result: 'Result',
    sent: 'Sent',
    rejected: 'Rejected',
    approved: 'approved',
    rejectedVote: 'rejected',
    onTeam: 'on the team',
    legend: 'A shaded cell marks a player picked for that team.',
  },
  credit: 'Icons: Lorc, Delapouite',
};

export const AVALON_TEXT: Record<Locale, AvalonText> = { vi, en };
