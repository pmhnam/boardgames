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

  'lobby.title': 'Game và phòng chơi',
  'lobby.loadingGames': 'Đang tải danh sách game…',
  'lobby.noRooms': 'Chưa có phòng nào.',

  'players.range': '{min}–{max} người chơi',
  'players.exact': '{count} người chơi',

  'room.hostedBy': 'Phòng của {name}',
  'room.unknownHost': 'Không rõ',
  'room.seats': '{count}/{max} người',
  'room.private': 'Riêng tư',
  'room.playing': 'Đang chơi',
  'room.full': 'Đầy',
  'room.open': 'Vào phòng',
  'room.join': 'Tham gia',
  'room.watch': 'Xem',

  'create.submit': 'Tạo phòng',
  'create.private': 'Riêng tư (chỉ vào bằng link mời)',

  'joinCode.title': 'Vào phòng bằng mã',
  'joinCode.label': 'Mã phòng',
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
