/** Vietnamese, and the list of message keys: every other language is checked against this one. */
export const vi = {
  'app.name': 'Board Game Platform',

  'nav.label': 'Điều hướng chính',
  'nav.history': 'Trận của tôi',
  'nav.signOut': 'Đăng xuất',
  'nav.language': 'Ngôn ngữ',
  'connection.online': 'Trực tuyến',
  'connection.reconnecting': 'Đang kết nối lại…',

  'login.title': 'Chơi với tư cách khách',
  'login.intro':
    'Chơi board game với bạn bè hoặc với máy ngay trên trình duyệt. Chỉ cần một cái tên.',
  'login.displayName': 'Tên hiển thị',
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

  'error.unknown': 'Đã có lỗi xảy ra.',
  'error.network': 'Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.',
  'error.unauthorized': 'Phiên đã hết hạn, hãy đăng nhập lại.',
  'error.rateLimited': 'Bạn thao tác quá nhanh. Đợi một chút rồi thử lại.',
  'error.internal': 'Máy chủ gặp lỗi. Thử lại sau.',
  'error.roomNotFound': 'Không tìm thấy phòng này.',
  'error.roomFull': 'Phòng đã đầy.',
  'error.roomNotOpen': 'Phòng này không còn nhận người.',
  'error.invalidRoomSettings': 'Cài đặt phòng không hợp lệ.',
};

export type MessageKey = keyof typeof vi;

export type Messages = Record<MessageKey, string>;
