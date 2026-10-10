/**
 * Tiện ích xử lý kiểm tra thời gian sự kiện (Múi giờ Việt Nam GMT+7)
 */

/**
 * Phân tích chuỗi ngày theo múi giờ Việt Nam (UTC+7)
 * @param {string} str - Định dạng hỗ trợ: "DD/MM/YYYY", "YYYY-MM-DD", có hoặc không có giờ phút giây
 * @param {boolean} isEndOfDay - Nếu true và chuỗi không kèm giờ cụ thể, tính là cuối ngày (23:59:59.999)
 * @returns {Date|null}
 */
export function parseVietnamDate(str, isEndOfDay = false) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;

  // 1. Định dạng DD/MM/YYYY hoặc DD-MM-YYYY (VD: 12/10/2026 hoặc 16/10/2026 23:59:59)
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const hour = dmyMatch[4] !== undefined ? dmyMatch[4].padStart(2, '0') : (isEndOfDay ? '23' : '00');
    const min = dmyMatch[5] !== undefined ? dmyMatch[5].padStart(2, '0') : (isEndOfDay ? '59' : '00');
    const sec = dmyMatch[6] !== undefined ? dmyMatch[6].padStart(2, '0') : (isEndOfDay ? '59' : '00');
    const ms = (dmyMatch[4] === undefined && isEndOfDay) ? '.999' : '.000';
    const isoString = `${year}-${month}-${day}T${hour}:${min}:${sec}${ms}+07:00`;
    const parsed = new Date(isoString);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // 2. Định dạng chuẩn quốc tế YYYY-MM-DD (VD: 2026-10-12)
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    const hour = ymdMatch[4] !== undefined ? ymdMatch[4].padStart(2, '0') : (isEndOfDay ? '23' : '00');
    const min = ymdMatch[5] !== undefined ? ymdMatch[5].padStart(2, '0') : (isEndOfDay ? '59' : '00');
    const sec = ymdMatch[6] !== undefined ? ymdMatch[6].padStart(2, '0') : (isEndOfDay ? '59' : '00');
    const ms = (ymdMatch[4] === undefined && isEndOfDay) ? '.999' : '.000';
    const isoString = `${year}-${month}-${day}T${hour}:${min}:${sec}${ms}+07:00`;
    const parsed = new Date(isoString);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Fallback định dạng ngày khác
  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Trích xuất cấu hình ngày từ biến môi trường (Hỗ trợ cả dạng 2 biến riêng hoặc 1 trường gộp)
 */
export function getEventConfig(env) {
  let startStr = env?.EVENT_START_DATE || env?.EVENT_START || '';
  let endStr = env?.EVENT_END_DATE || env?.EVENT_END || '';

  // Hỗ trợ trường gộp 1 dòng: EVENT_DATE_RANGE hoặc EVENT_TIME_RANGE (VD: "12/10/2026 - 16/10/2026")
  const rangeStr = env?.EVENT_DATE_RANGE || env?.EVENT_TIME_RANGE || '';
  if (rangeStr && typeof rangeStr === 'string' && (!startStr || !endStr)) {
    const parts = rangeStr.split(/\s*(?:-|–|—|to|đến)\s*/i);
    if (parts.length >= 2) {
      if (!startStr) startStr = parts[0].trim();
      if (!endStr) endStr = parts[1].trim();
    }
  }

  return {
    startStr: startStr ? String(startStr).trim() : '',
    endStr: endStr ? String(endStr).trim() : ''
  };
}

/**
 * Kiểm tra trạng thái hiện tại của sự kiện
 * @param {object} env - Biến môi trường
 * @param {Date} [currentTime] - Thời gian hiện tại để so sánh (mặc định new Date())
 */
export function checkEventStatus(env, currentTime = new Date()) {
  const { startStr, endStr } = getEventConfig(env);

  const startDate = parseVietnamDate(startStr, false);
  const endDate = parseVietnamDate(endStr, true);

  const nowMs = currentTime.getTime();

  // NẾU KHÔNG CẤU HÌNH (hoặc để trống): Chạy mãi mãi
  if (!startDate && !endDate) {
    return {
      isOpen: true,
      status: 'unlimited',
      message: 'Sự kiện đang mở nhận đăng ký.',
      startDateStr: '',
      endDateStr: ''
    };
  }

  // 1. Chưa đến ngày bắt đầu
  if (startDate && nowMs < startDate.getTime()) {
    const timeDetail = endStr
      ? `từ ngày ${startStr} đến hết ngày ${endStr}`
      : `từ ngày ${startStr}`;
    return {
      isOpen: false,
      status: 'upcoming',
      message: `Sự kiện chưa bắt đầu. Thời gian tiếp nhận đăng ký ${timeDetail}. Vui lòng quay lại sau!`,
      startDateStr: startStr,
      endDateStr: endStr
    };
  }

  // 2. Đã qua ngày kết thúc
  if (endDate && nowMs > endDate.getTime()) {
    return {
      isOpen: false,
      status: 'ended',
      message: `Sự kiện đã kết thúc vào ngày ${endStr}. Cảm ơn bạn đã quan tâm tham gia!`,
      startDateStr: startStr,
      endDateStr: endStr
    };
  }

  // 3. Trong thời gian sự kiện diễn ra
  return {
    isOpen: true,
    status: 'active',
    message: 'Sự kiện đang diễn ra.',
    startDateStr: startStr,
    endDateStr: endStr
  };
}
