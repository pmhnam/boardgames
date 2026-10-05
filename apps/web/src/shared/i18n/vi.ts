/** Vietnamese, and the list of message keys: every other language is checked against this one. */
export const vi = {
  'app.name': 'Board Game Platform',

  'nav.label': 'Điều hướng chính',
  'nav.history': 'Trận của tôi',
  'nav.signOut': 'Đăng xuất',
  'nav.language': 'Ngôn ngữ',
  'connection.online': 'Trực tuyến',
  'connection.reconnecting': 'Đang kết nối lại…',

  'login.title': 'Đăng nhập bằng username',
  'login.intro':
    'Nhập lại username cũ để tiếp tục phòng và trận của bạn. Username mới sẽ tạo người chơi mới.',
  'login.displayName': 'Username',
  'login.submit': 'Tiếp tục',

  'join.joining': 'Đang vào phòng {code}…',
  'join.backToLobby': 'Về trang chủ',

  'lobby.greeting': 'Chào {name}!',
  'lobby.subtitle': 'Chọn một game để mở phòng, hoặc vào phòng đang chờ người.',
  'lobby.games': 'Chọn game',
  'lobby.noGames': 'Chưa có game nào được cài đặt.',
  'lobby.openRooms': 'Phòng đang mở',
  'lobby.noRooms': 'Chưa có phòng nào đang mở. Chọn một game để tạo phòng đầu tiên.',
  'lobby.retry': 'Thử lại',

  'players.range': '{min}–{max} người chơi',
  'players.exact': '{count} người chơi',
  'card.bots': 'Có máy',
  'card.joinable': '{count} phòng đang chờ',

  'room.hostedBy': 'Phòng của {name}',
  'room.unknownHost': 'Không rõ',
  'room.seats': '{count}/{max} người',
  'room.bots': '{count} máy',
  'room.private': 'Riêng tư',
  'room.playing': 'Đang chơi',
  'room.full': 'Đầy',
  'room.open': 'Vào phòng',
  'room.join': 'Tham gia',
  'room.joining': 'Đang vào…',
  'room.watch': 'Xem',

  'continue.title': 'Tiếp tục',
  'continue.waiting': 'Đang chờ',
  'continue.resume': 'Vào trận',
  'continue.leave': 'Rời phòng',

  'create.title': 'Tạo phòng {game}',
  'create.submit': 'Tạo phòng',
  'create.pending': 'Đang tạo…',
  'create.cancel': 'Huỷ',
  'create.visibility': 'Ai vào được',
  'create.public': 'Công khai',
  'create.publicHint': 'Hiện trong danh sách phòng, ai cũng vào được.',
  'create.private': 'Riêng tư',
  'create.privateHint': 'Chỉ vào được bằng mã phòng hoặc link mời.',
  'create.defaultsOnly':
    'Không tải được tuỳ chọn của game. Phòng sẽ dùng cài đặt mặc định, chủ phòng đổi được sau.',

  'joinCode.title': 'Vào phòng bằng mã',
  'joinCode.submit': 'Vào phòng',

  'common.you': 'bạn',
  'common.loading': 'Đang tải…',

  'roomPage.loading': 'Đang tải phòng…',
  'roomPage.title': 'Phòng {code}',
  'roomPage.inviteLink': 'link mời:',
  'roomPage.copy': 'Sao chép',
  'roomPage.host': 'Chủ phòng',
  'roomPage.computer': 'Máy ({level})',
  'roomPage.ready': 'Sẵn sàng',
  'roomPage.notReady': 'Chưa sẵn sàng',
  'roomPage.removeBot': 'Xoá',
  'roomPage.matchInProgress': 'Đang có một trận diễn ra.',
  'roomPage.settingsHint': 'Đổi cài đặt sẽ yêu cầu mọi người xác nhận sẵn sàng lại.',
  'roomPage.computerPlayer': 'Người chơi máy',
  'roomPage.addBot': 'Thêm máy',
  'roomPage.takeSeat': 'Ngồi vào',
  'roomPage.imReady': 'Tôi sẵn sàng',
  'roomPage.start': 'Bắt đầu trận',
  'botLevel.easy': 'Dễ',
  'botLevel.normal': 'Thường',
  'botLevel.hard': 'Khó',

  'history.empty': 'Chưa có trận nào.',
  'history.wonBy': 'Thắng: {names}',
  'history.abandoned': 'Bỏ dở',
  'history.replay': 'Xem lại',

  'error.unknown': 'Đã có lỗi xảy ra.',
  'error.network': 'Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.',
  'error.unauthorized': 'Phiên đã hết hạn, hãy đăng nhập lại.',
  'error.rateLimited': 'Bạn thao tác quá nhanh. Đợi một chút rồi thử lại.',
  'error.internal': 'Máy chủ gặp lỗi. Thử lại sau.',
  'error.roomNotFound': 'Không tìm thấy phòng này.',
  'error.roomFull': 'Phòng đã đầy.',
  'error.roomNotOpen': 'Phòng này không còn nhận người.',
  'error.invalidRoomSettings': 'Cài đặt phòng không hợp lệ.',
  'error.playersNotReady': 'Chưa phải ai cũng sẵn sàng.',
  'error.notEnoughPlayers': 'Chưa đủ người để bắt đầu trận.',
  'error.notRoomHost': 'Chỉ chủ phòng mới làm được việc này.',
  'error.botsNotSupported': 'Game này không chơi được với máy.',
};

export type MessageKey = keyof typeof vi;

export type Messages = Record<MessageKey, string>;
