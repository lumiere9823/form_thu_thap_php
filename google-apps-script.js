/**
 * ====================================================================
 * MÃ NGUỒN TỰ ĐỘNG GHI DỮ LIỆU TỪ LANDING PAGE VÀO GOOGLE SHEETS
 * Hỗ trợ: Họ tên, Số điện thoại, Địa chỉ, Tên Facebook, Số may mắn, Nhóm đối tượng
 * ====================================================================
 */

// Đặt true khi sự kiện đã đóng để ngừng tiếp nhận đăng ký mới
var EVENT_CLOSED = false;
var EVENT_CLOSED_MESSAGE = "Sự kiện đã đóng và kết thúc, hệ thống không còn tiếp nhận đăng ký mới.";

// Hàm khởi tạo tiêu đề cột nếu sheet còn trống (Có thể bấm "Chạy" trực tiếp trong Apps Script)
function setupSheet(sheet) {
  if (!sheet) {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    sheet = doc ? doc.getActiveSheet() : null;
  }
  if (!sheet) {
    Logger.log("Không tìm thấy bảng tính Google Sheet đang hoạt động!");
    return;
  }

  var headers = [
    "Thời gian gửi",
    "Họ và tên",
    "Số điện thoại",
    "Địa chỉ",
    "Tên Facebook",
    "Số may mắn",
    "Bạn là",
    "Thiết bị / Ghi chú"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  // Đồng bộ header khi Sheet đang dùng cấu trúc cũ ít cột hơn.
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#E8F0FE");
  headerRange.setFontColor("#1A73E8");

  // Cột Số điện thoại (C) luôn ở dạng Plain Text để không mất số 0 đầu.
  sheet.getRange("C:C").setNumberFormat("@");
}

function sheetValue(value, maxLength) {
  var text = String(value || "").slice(0, maxLength);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

// So sánh chuỗi theo thời gian cố định để tránh timing attack khi kiểm tra shared secret.
function constantTimeEquals(a, b) {
  var strA = String(a || "");
  var strB = String(b || "");
  if (strA.length !== strB.length) return false;
  var diff = 0;
  for (var i = 0; i < strA.length; i++) {
    diff |= strA.charCodeAt(i) ^ strB.charCodeAt(i);
  }
  return diff === 0;
}

function verifySharedSecret(providedSecret) {
  var expectedSecret = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
  if (!expectedSecret) return true;
  return constantTimeEquals(providedSecret, expectedSecret);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function findDuplicate(sheet, phone) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return "";
  if (lastRow > 50000) {
    throw new Error("Bảng dữ liệu đã đạt giới hạn an toàn, vui lòng tạo bảng mới");
  }
  var values = sheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues();
  var normalizedPhone = normalizePhone(phone);
  for (var i = 0; i < values.length; i++) {
    if (normalizePhone(values[i][2]) === normalizedPhone) return "Số điện thoại này đã được đăng ký";
  }
  return "";
}

// Hàm để bạn bấm "Chạy" (Run) trực tiếp trong Apps Script để kiểm tra thử nghiệm
function chayThuNghiem() {
  var result = doPost({
    parameter: {
      fullName: "TEST DOPOST",
      phone: "0900000000",
      address: "Địa chỉ kiểm thử",
      facebookName: "Nguyễn Văn Thử Nghiệm",
      luckyNumber: "7",
      memberType: "Khách hàng",
      device: "Apps Script diagnostic"
    }
  });
  Logger.log(result.getContent());
}

// Xử lý khi có yêu cầu gửi dữ liệu (POST request từ Landing Page)
function doPost(e) {
  if (!e) {
    e = { parameter: {} };
  }
  var lock = LockService.getScriptLock();
  // Khóa tạm 10 giây để tránh xung đột ghi đè khi nhiều người cùng gửi
  if (!lock.tryLock(10000)) {
    return ContentService.createTextOutput(JSON.stringify({ status: "busy" })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    if (EVENT_CLOSED) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: "closed", message: EVENT_CLOSED_MESSAGE }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var doc = SpreadsheetApp.getActiveSpreadsheet();
    if (!doc) {
      throw new Error("Vui lòng mở Apps Script từ bên trong Google Sheets (Tiện ích mở rộng > Apps Script) để tự động liên kết bảng tính!");
    }
    var sheet = doc.getActiveSheet();
    setupSheet(sheet);

    var data = {};
    // 1. Đọc từ e.parameter (chuẩn URLSearchParams / FormData)
    if (e.parameter) {
      for (var key in e.parameter) {
        data[key] = e.parameter[key];
      }
    }

    // 2. Đọc từ e.postData (chuẩn JSON / text payload)
    if (e.postData && e.postData.contents) {
      if (e.postData.contents.length > 10000) {
        throw new Error("Dữ liệu gửi lên vượt quá giới hạn cho phép");
      }
      try {
        var parsed = JSON.parse(e.postData.contents);
        for (var k in parsed) {
          data[k] = parsed[k];
        }
      } catch (err) {
        // Không phải JSON thuần, đã có data từ e.parameter
      }
    }

    var timestamp = new Date();
    var formattedDate = Utilities.formatDate(timestamp, "GMT+7", "dd/MM/yyyy HH:mm:ss");

    if (!verifySharedSecret(data.secret)) {
      throw new Error("Không có quyền truy cập");
    }

    var fullName = sheetValue(data.fullName || data.name, 120);
    var rawPhone = String(data.phone || "").replace(/\s/g, "").slice(0, 20);
    var phone = "'" + rawPhone;
    var address = sheetValue(data.address, 250);
    var facebookName = sheetValue(data.facebookName || data.facebook, 120);
    var luckyNumber = sheetValue(data.luckyNumber, 12);
    var memberType = sheetValue(data.memberType, 30);
    var userAgent = sheetValue(data.device || "Trình duyệt Web", 100);

    if (fullName.length > 120 || rawPhone.length > 20 || address.length > 250 ||
      facebookName.length > 120 || luckyNumber.length > 12 || memberType.length > 30) {
      throw new Error("Dữ liệu gửi lên vượt quá giới hạn cho phép");
    }

    // Kiểm tra lại ở máy chủ vì dữ liệu gửi từ trình duyệt luôn có thể bị giả mạo.
    if (fullName.length < 2 || fullName.length > 120 ||
      rawPhone.match(/^0[0-9]{9,10}$/) === null ||
      address.length < 2 || address.length > 250 ||
      luckyNumber.match(/^[0-9]{1,12}$/) === null ||
      ["Khách hàng", "CBNV Nam A Bank"].indexOf(memberType) === -1) {
      throw new Error("Dữ liệu không hợp lệ");
    }

    if (facebookName.length < 2) {
      throw new Error("Tên Facebook không hợp lệ");
    }

    var duplicateMessage = findDuplicate(sheet, rawPhone);
    if (duplicateMessage) {
      throw new Error(duplicateMessage);
    }

    // Giới hạn toàn cục theo phút để giảm spam tự động vào Google Sheet.
    var properties = PropertiesService.getScriptProperties();
    var minuteKey = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMddHHmm");
    var requestKey = "requests_" + minuteKey;
    var requestCount = Number(properties.getProperty(requestKey) || 0);
    if (requestCount >= 60) {
      throw new Error("Hệ thống đang nhận quá nhiều yêu cầu, vui lòng thử lại sau");
    }

    // Thêm dòng dữ liệu mới vào Google Sheet
    sheet.appendRow([
      formattedDate,
      fullName,
      phone,
      address,
      facebookName,
      luckyNumber,
      memberType,
      userAgent
    ]);
    properties.setProperty(requestKey, String(requestCount + 1));

    // Trả về kết quả thành công dưới dạng JSON
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "success",
        message: "Dữ liệu đã được lưu thành công vào Excel Online!",
        row: sheet.getLastRow()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

// Xử lý kiểm tra trạng thái Webhook (GET request)
function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  if (EVENT_CLOSED) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "closed", message: EVENT_CLOSED_MESSAGE }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (params.action === "checkDuplicate") {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var message = findDuplicate(sheet, params.phone);
    var result = JSON.stringify({ status: message ? "duplicate" : "available", message: message });
    var callback = String(params.callback || "");
    if (/^[A-Za-z_$][\w$]*$/.test(callback)) {
      return ContentService
        .createTextOutput(callback + "(" + result + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(result)
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({
      status: "active",
      message: "Webhook Google Sheets đang hoạt động bình thường!"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
