/**
 * ==========================================================================
 * LOGIC XỬ LÝ DỮ LIỆU ĐĂNG KÝ & KẾT NỐI EXCEL ONLINE (GOOGLE SHEETS)
 * ==========================================================================
 */

// Các phần tử DOM
const DOM = {
  // Form elements
  form: document.getElementById('leadCaptureForm'),
  fullName: document.getElementById('fullName'),
  phone: document.getElementById('phone'),
  address: document.getElementById('address'),
  facebookName: document.getElementById('facebookName'),
  luckyNumber: document.getElementById('luckyNumber'),
  memberType: document.querySelector('input[name="memberType"]'),
  btnSubmit: document.getElementById('btnSubmit'),
  formAlertError: document.getElementById('formAlertError'),
  formAlertErrorMsg: document.getElementById('formAlertErrorMsg'),

  // Groups
  groupFullName: document.getElementById('groupFullName'),
  groupPhone: document.getElementById('groupPhone'),
  groupAddress: document.getElementById('groupAddress'),
  groupFacebook: document.getElementById('groupFacebook'),
  groupLuckyNumber: document.getElementById('groupLuckyNumber'),
  groupMemberType: document.getElementById('groupMemberType'),

  // Success Modal
  modalSuccess: document.getElementById('modalSuccess'),
  btnCloseSuccess: document.getElementById('btnCloseSuccess'),
  btnContinue: document.getElementById('btnContinue'),
  sumFullName: document.getElementById('sumFullName'),
  sumPhone: document.getElementById('sumPhone'),
  sumAddress: document.getElementById('sumAddress'),
  sumFacebook: document.getElementById('sumFacebook'),
  sumLuckyNumber: document.getElementById('sumLuckyNumber'),
  sumMemberType: document.getElementById('sumMemberType')
};

// ==========================================
// HÀM TIỆN ÍCH & VALIDATION
// ==========================================

// ==========================================
// KIỂM TRA TÍNH HỢP LỆ FORM (VALIDATION)
// ==========================================
function validateForm() {
  let isValid = true;
  let firstErrorInput = null;

  const checkField = (value, group, input, message) => {
    const valid = Boolean(value);
    group.classList.toggle('has-error', !valid);
    group.classList.toggle('has-success', valid);
    if (!valid) {
      isValid = false;
      if (!firstErrorInput) firstErrorInput = input;
    }
    const error = group.querySelector('.error-msg span');
    if (error) error.textContent = message;
  };

  // 1. Họ và tên
  const nameVal = DOM.fullName.value.trim();
  checkField(nameVal.length >= 2 ? nameVal : '', DOM.groupFullName, DOM.fullName, 'Vui lòng nhập họ và tên của bạn.');

  // 2. Số điện thoại
  const phoneVal = DOM.phone.value.trim();
  checkField(/^0[0-9]{9,10}$/.test(phoneVal.replace(/\s/g, '')) ? phoneVal : '', DOM.groupPhone, DOM.phone, 'Vui lòng nhập số điện thoại hợp lệ.');

  // 3. Địa chỉ
  checkField(DOM.address.value.trim(), DOM.groupAddress, DOM.address, 'Vui lòng nhập địa chỉ.');

  // 4. Tên Facebook
  const facebookNameVal = DOM.facebookName.value.trim();
  checkField(facebookNameVal.length >= 2 ? facebookNameVal : '', DOM.groupFacebook, DOM.facebookName, 'Vui lòng nhập tên Facebook.');

  // 5. Số may mắn
  checkField(DOM.luckyNumber.value.trim(), DOM.groupLuckyNumber, DOM.luckyNumber, 'Vui lòng nhập số may mắn.');

  // 6. Nhóm đối tượng
  const memberType = document.querySelector('input[name="memberType"]:checked');
  checkField(memberType ? memberType.value : '', DOM.groupMemberType, DOM.memberType, 'Vui lòng chọn một đáp án.');

  if (!isValid && firstErrorInput) {
    firstErrorInput.focus();
    DOM.formAlertError.style.display = 'flex';
    DOM.formAlertErrorMsg.textContent = 'Vui lòng kiểm tra lại các trường thông tin được đánh dấu đỏ!';
  } else {
    DOM.formAlertError.style.display = 'none';
  }

  return isValid;
}

// Xóa lỗi khi gõ
[DOM.fullName, DOM.phone, DOM.address, DOM.facebookName, DOM.luckyNumber].forEach(input => {
  input.addEventListener('input', () => {
    const parentGroup = input.closest('.form-group');
    if (parentGroup) {
      parentGroup.classList.remove('has-error');
    }
    DOM.formAlertError.style.display = 'none';
  });
});

// ==========================================
// GỬI DỮ LIỆU ĐẾN EXCEL ONLINE (GOOGLE SHEETS)
// ==========================================
async function sendToGoogleSheet(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // > timeout webhook phía PHP (12s) + độ trễ mạng
  try {
    const response = await fetch('/api/submit.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok || result.status === 'error') {
      throw new Error(result.message || 'Không thể lưu thông tin.');
    }

    return { success: true, synced: true };
  } catch (error) {
    console.error('Lỗi khi gửi webhook:', error);
    throw new Error(error.name === 'AbortError' ? 'Có lỗi xảy ra khi gửi thông tin. Vui lòng thử lại!' : (error.message || 'Không thể kết nối đến máy chủ lưu dữ liệu.'));
  } finally {
    clearTimeout(timeoutId);
  }
}

// ==========================================
// XỬ LÝ NỘP FORM (SUBMIT)
// ==========================================
DOM.form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  // Khóa nút bấm & bật trạng thái loading
  DOM.btnSubmit.disabled = true;
  DOM.btnSubmit.classList.add('is-submitting');
  const textLoading = DOM.btnSubmit.querySelector('.btn-text-loading');
  if (textLoading) textLoading.style.display = 'inline';

  const formData = {
    fullName: DOM.fullName.value.trim(),
    phone: DOM.phone.value.trim(),
    address: DOM.address.value.trim(),
    facebookName: DOM.facebookName.value.trim(),
    luckyNumber: DOM.luckyNumber.value.trim(),
    memberType: document.querySelector('input[name="memberType"]:checked').value,
    submittedAt: new Date().toLocaleString('vi-VN'),
    device: navigator.userAgent.includes('Mobile') ? 'Điện thoại (Mobile)' : 'Máy tính (Desktop)'
  };

  try {
    // 1. Gửi đồng bộ lên Google Sheets
    await sendToGoogleSheet(formData);

    // 2. Hiển thị modal chúc mừng thành công
    DOM.sumFullName.textContent = formData.fullName;
    DOM.sumPhone.textContent = formData.phone;
    DOM.sumAddress.textContent = formData.address;
    DOM.sumFacebook.textContent = formData.facebookName;
    DOM.sumLuckyNumber.textContent = formData.luckyNumber;
    DOM.sumMemberType.textContent = formData.memberType;
    DOM.modalSuccess.classList.add('active');

    // 3. Đặt lại form sạch sẽ
    DOM.form.reset();
    [DOM.groupFullName, DOM.groupPhone, DOM.groupAddress, DOM.groupFacebook, DOM.groupLuckyNumber, DOM.groupMemberType].forEach(group => {
      group.classList.remove('has-success', 'has-error');
    });

  } catch (err) {
    DOM.formAlertError.style.display = 'flex';
    DOM.formAlertErrorMsg.textContent = err.message || 'Có lỗi xảy ra khi gửi thông tin. Vui lòng thử lại!';
  } finally {
    DOM.btnSubmit.disabled = false;
    DOM.btnSubmit.classList.remove('is-submitting');
    if (textLoading) textLoading.style.display = 'none';
  }
});

// Đóng modal thành công
[DOM.btnCloseSuccess, DOM.btnContinue].forEach(btn => {
  if (btn) {
    btn.addEventListener('click', () => {
      DOM.modalSuccess.classList.remove('active');
    });
  }
});

// Đóng modal khi bấm ra ngoài nền tối
if (DOM.modalSuccess) {
  DOM.modalSuccess.addEventListener('click', (e) => {
    if (e.target === DOM.modalSuccess) {
      DOM.modalSuccess.classList.remove('active');
    }
  });
}
