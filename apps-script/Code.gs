/**
 * MÁY CHỦ cho app "Chi tiêu gia đình" – NHIỀU TÀI KHOẢN (mỗi gia đình 1 tài khoản SĐT + mật khẩu).
 * Dán toàn bộ file này vào Google Sheet > Tiện ích mở rộng > Apps Script.
 *
 * BƯỚC BẮT BUỘC: điền SĐT và mật khẩu ADMIN vào 2 dòng dưới (chỉ điền trong Apps Script,
 * KHÔNG đưa lên GitHub), lưu lại rồi chạy hàm caiDat 1 lần.
 */
const ADMIN_SDT = '';   // ví dụ '09xxxxxxxx'
const ADMIN_MK  = '';   // mật khẩu admin, ít nhất 6 ký tự

const SH_ACC = 'TaiKhoan', SH_TX = 'DuLieu', SH_CFG = 'CauHinhTK';
const ACC_H = ['SĐT', 'Salt', 'Hash', 'Vai trò', 'Trạng thái', 'Ngày tạo', 'Hoạt động gần nhất', 'Tên / ghi chú'];
const TX_COLS = ['acc', 'id', 'date', 'type', 'cat', 'amount', 'member', 'method', 'card', 'note', 'u', 'deleted', 'su', 'nhom', 'the'];
const TX_H = ['Tài khoản', 'ID', 'Ngày', 'Loại', 'Mã nhóm', 'Số tiền', 'Thành viên', 'Thanh toán', 'Mã thẻ', 'Ghi chú', 'Sửa lúc', 'Đã xoá', 'Server', 'Tên nhóm', 'Tên thẻ'];
const TOKEN_DAYS = 180;

function doGet() { return out({ ok: true, msg: 'API Chi tiêu gia đình (nhiều tài khoản) đang chạy.' }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const req = JSON.parse((e.postData && e.postData.contents) || '{}');
    const fn = ACTIONS[req.action];
    if (!fn) return out({ ok: false, err: 'Hành động không hợp lệ' });
    return out(Object.assign({ ok: true }, fn(req)));
  } catch (err) {
    return out({ ok: false, err: err.message || String(err), code: err.code || '' });
  } finally {
    lock.releaseLock();
  }
}

/* ======================= CÁC HÀNH ĐỘNG ======================= */
const ACTIONS = {
  register(req) {
    const phone = normPhone(req.phone), pw = String(req.pw || '');
    checkPhone(phone); checkPw(pw);
    if (findAcc(phone)) fail('Số điện thoại này đã được đăng ký');
    createAcc(phone, pw, 'user', '');
    const a = findAcc(phone);
    return { token: issue(a), phone: phone, role: 'user' };
  },
  login(req) {
    const phone = normPhone(req.phone), pw = String(req.pw || '');
    const cache = CacheService.getScriptCache(), key = 'fail_' + phone, n = Number(cache.get(key) || 0);
    if (n >= 5) fail('Sai mật khẩu quá nhiều lần, vui lòng thử lại sau 10 phút');
    const a = findAcc(phone);
    if (!a || hashPw(pw, a.salt) !== a.hash) { cache.put(key, String(n + 1), 600); fail('Sai số điện thoại hoặc mật khẩu'); }
    if (a.status === 'locked') fail('Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.');
    cache.remove(key); touch(a, true);
    return { token: issue(a), phone: a.phone, role: a.role };
  },
  me(req) { const a = auth(req); return { phone: a.phone, role: a.role, name: a.name }; },
  changePw(req) {
    const a = auth(req);
    if (hashPw(String(req.old || ''), a.salt) !== a.hash) fail('Mật khẩu hiện tại không đúng');
    checkPw(String(req.pw || ''));
    setPw(a, String(req.pw));
    return { token: issue(findAcc(a.phone)) };
  },
  sync(req) {
    const a = auth(req);
    let target = a.phone;
    if (a.role === 'admin' && req.as) { // admin xem/sửa tài khoản khác; không có "as" = dữ liệu riêng của admin
      target = normPhone(req.as);
      if (!findAcc(target)) fail('Không tìm thấy tài khoản ' + target);
    }
    return doSync(target, req);
  },

  /* ---------- chỉ admin ---------- */
  'admin.list'(req) {
    adminOnly(req);
    const m = String(req.month || '');
    const st = {};
    const v = txSheet().getDataRange().getValues();
    for (let i = 1; i < v.length; i++) {
      const r = v[i]; if (String(r[11]) === '1') continue;
      const acc = normPhone(r[0]); const s = st[acc] || (st[acc] = { n: 0, chi: 0, thu: 0, last: '' });
      const d = String(r[2]); s.n++;
      if (m && d.indexOf(m) === 0) { if (r[3] === 'chi') s.chi += Number(r[5]) || 0; else s.thu += Number(r[5]) || 0; }
      if (d > s.last) s.last = d;
    }
    const users = readAccs().filter(a => a.role !== 'admin').map(a => {
      const s = st[a.phone] || { n: 0, chi: 0, thu: 0, last: '' };
      return { phone: a.phone, name: a.name, status: a.status, created: a.created, lastSeen: a.lastSeen,
        txCount: s.n, chiM: s.chi, thuM: s.thu, lastTx: s.last };
    });
    return { users: users };
  },
  'admin.create'(req) {
    adminOnly(req);
    const phone = normPhone(req.phone), pw = String(req.pw || '');
    checkPhone(phone); checkPw(pw);
    if (findAcc(phone)) fail('Số điện thoại này đã có tài khoản');
    createAcc(phone, pw, 'user', String(req.name || ''));
    return {};
  },
  'admin.update'(req) {
    adminOnly(req); const a = target(req);
    accSheet().getRange(a.row, 8).setValue(String(req.name || ''));
    return {};
  },
  'admin.setStatus'(req) {
    adminOnly(req); const a = target(req);
    const s = req.status === 'locked' ? 'locked' : 'active';
    accSheet().getRange(a.row, 5).setValue(s);
    return {};
  },
  'admin.resetPw'(req) {
    adminOnly(req); const a = target(req);
    checkPw(String(req.pw || '')); setPw(a, String(req.pw));
    return {};
  },
  'admin.delete'(req) {
    adminOnly(req); const a = target(req);
    deleteRowsOf(txSheet(), a.phone);
    deleteRowsOf(cfgSheet(), a.phone);
    accSheet().deleteRow(a.row);
    return {};
  }
};

/* ======================= ĐỒNG BỘ DỮ LIỆU ======================= */
function doSync(acc, req) {
  const sh = txSheet(), now = Date.now();
  const data = sh.getDataRange().getValues();
  const idx = {};
  for (let i = 1; i < data.length; i++) if (normPhone(data[i][0]) === acc) idx[String(data[i][1])] = i;
  const appends = [];
  (req.tx || []).forEach(function (t) {
    if (!t || !t.id) return;
    const row = toRow(acc, t, now), i = idx[t.id];
    if (i === undefined) { appends.push(row); idx[t.id] = -1; }
    else if (i > 0 && Number(data[i][10]) <= Number(t.u || 0)) sh.getRange(i + 1, 1, 1, TX_COLS.length).setValues([row]);
  });
  if (appends.length) appendRows(sh, appends);

  // cấu hình (nhóm chi, hạn mức, thẻ...) – bản mới nhất thắng
  const cs = cfgSheet(), cv = cs.getDataRange().getValues();
  let crow = -1, cfg = null, cfgU = 0;
  for (let i = 1; i < cv.length; i++) if (normPhone(cv[i][0]) === acc) { crow = i + 1; try { cfg = JSON.parse(cv[i][1]); } catch (x) {} cfgU = Number(cv[i][2]) || 0; break; }
  if (req.cfg && (!cfg || (!req.first && Number(req.cfgU) > cfgU))) {
    cfg = req.cfg; cfgU = Number(req.cfgU) || now;
    const row = [acc, JSON.stringify(cfg), String(cfgU)];
    if (crow > 0) cs.getRange(crow, 1, 1, 3).setValues([row]); else appendRows(cs, [row]);
  }

  const since = Number(req.since) || 0, all = sh.getDataRange().getValues(), res = [];
  for (let i = 1; i < all.length; i++) if (normPhone(all[i][0]) === acc && Number(all[i][12]) > since) res.push(fromRow(all[i]));
  const sendCfg = req.first || cfgU > (Number(req.cfgU) || 0);
  return { now: now, tx: res, cfg: sendCfg ? cfg : null, cfgU: cfgU };
}
function toRow(acc, t, now) {
  return [acc, t.id, t.date || '', t.type || '', t.cat || '', String(t.amount || 0), t.member || '', t.method || '', t.card || '',
    t.note || '', String(t.u || now), t.deleted ? '1' : '', String(now), t.catName || '', t.cardName || ''];
}
function fromRow(r) {
  let d = r[2];
  if (d instanceof Date) d = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const o = { id: String(r[1]), date: String(d), type: String(r[3]), cat: String(r[4]), amount: Number(r[5]) || 0,
    member: String(r[6]), method: String(r[7]), note: String(r[9]), u: Number(r[10]) || 0 };
  if (r[8]) o.card = String(r[8]);
  if (String(r[11]) === '1') o.deleted = true;
  return o;
}

/* ======================= TÀI KHOẢN ======================= */
function readAccs() {
  const v = accSheet().getDataRange().getValues(), r = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    r.push({ row: i + 1, phone: normPhone(v[i][0]), salt: String(v[i][1]), hash: String(v[i][2]), role: String(v[i][3]),
      status: String(v[i][4]), created: Number(v[i][5]) || 0, lastSeen: Number(v[i][6]) || 0, name: String(v[i][7] || '') });
  }
  return r;
}
function findAcc(phone) { return readAccs().filter(a => a.phone === phone)[0] || null; }
function createAcc(phone, pw, role, name) {
  const salt = newSalt(), now = String(Date.now());
  appendRows(accSheet(), [[phone, salt, hashPw(pw, salt), role, 'active', now, now, name]]);
}
function setPw(a, pw) { const salt = newSalt(); accSheet().getRange(a.row, 2, 1, 2).setValues([[salt, hashPw(pw, salt)]]); }
function touch(a, force) { const now = Date.now(); if (force || now - a.lastSeen > 10 * 60000) accSheet().getRange(a.row, 7).setValue(String(now)); }
function auth(req) {
  const t = verify(req.token);
  if (!t) fail('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 'AUTH');
  const a = findAcc(t.phone);
  if (!a) fail('Tài khoản không còn tồn tại', 'AUTH');
  if (a.hash.slice(0, 10) !== t.hv) fail('Mật khẩu đã thay đổi, vui lòng đăng nhập lại', 'AUTH');
  if (a.status === 'locked') fail('Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.', 'AUTH');
  touch(a, false);
  return a;
}
function adminOnly(req) { const a = auth(req); if (a.role !== 'admin') fail('Bạn không có quyền quản trị'); return a; }
function target(req) {
  const a = findAcc(normPhone(req.phone));
  if (!a) fail('Không tìm thấy tài khoản');
  if (a.role === 'admin') fail('Không thể thao tác trên tài khoản quản trị');
  return a;
}

/* ======================= BẢO MẬT ======================= */
function secret() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SECRET', s); }
  return s;
}
function b64(x) { return Utilities.base64EncodeWebSafe(x).replace(/=+$/, ''); }
function unb64(s) { while (s.length % 4) s += '='; return Utilities.newBlob(Utilities.base64DecodeWebSafe(s)).getDataAsString(); }
function sign(payload) { return b64(Utilities.computeHmacSha256Signature(payload, secret())); }
function issue(a) {
  const payload = [a.phone, Date.now() + TOKEN_DAYS * 864e5, a.hash.slice(0, 10)].join('|');
  return b64(payload) + '.' + sign(payload);
}
function verify(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const payload = unb64(parts[0]);
    if (sign(payload) !== parts[1]) return null;
    const f = payload.split('|');
    if (Number(f[1]) < Date.now()) return null;
    return { phone: f[0], hv: f[2] };
  } catch (e) { return null; }
}
function hashPw(pw, salt) {
  let h = salt + '|' + pw;
  for (let i = 0; i < 200; i++) h = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}
function hex(b) { return b.map(x => ((x + 256) % 256).toString(16).padStart(2, '0')).join(''); }
function newSalt() { return Utilities.getUuid().replace(/-/g, ''); }

/* ======================= TIỆN ÍCH ======================= */
function normPhone(s) {
  let p = String(s == null ? '' : s).replace(/\D/g, '');
  if (p.indexOf('84') === 0 && p.length === 11) p = '0' + p.slice(2);
  if (p.length === 9) p = '0' + p;
  return p;
}
function checkPhone(p) { if (!/^0\d{9}$/.test(p)) fail('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)'); }
function checkPw(p) { if (String(p).length < 6) fail('Mật khẩu cần ít nhất 6 ký tự'); }
function fail(msg, code) { const e = new Error(msg); e.code = code || ''; throw e; }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function getSheet(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), header.length).setNumberFormat('@'); // giữ nguyên chữ (số 0 đầu SĐT, ngày...)
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#e8e6ff');
    sh.setFrozenRows(1);
  }
  return sh;
}
function accSheet() { return getSheet(SH_ACC, ACC_H); }
function txSheet() { return getSheet(SH_TX, TX_H); }
function cfgSheet() { return getSheet(SH_CFG, ['Tài khoản', 'Cấu hình (JSON)', 'Sửa lúc']); }
function appendRows(sh, rows) {
  const last = sh.getLastRow(), need = last + rows.length - sh.getMaxRows();
  if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need + 200);
  sh.getRange(last + 1, 1, rows.length, rows[0].length).setNumberFormat('@').setValues(rows.map(r => r.map(x => String(x))));
}
function deleteRowsOf(sh, phone) {
  const v = sh.getDataRange().getValues();
  const keep = v.filter((r, i) => i === 0 || normPhone(r[0]) !== phone);
  if (keep.length === v.length) return;
  sh.getRange(1, 1, v.length, v[0].length).clearContent();
  sh.getRange(1, 1, keep.length, keep[0].length).setNumberFormat('@').setValues(keep.map(r => r.map(x => String(x))));
}

/** Chạy hàm này 1 lần (nút ▶ Chạy) để cấp quyền, tạo sheet và tạo tài khoản admin. */
function caiDat() {
  accSheet(); txSheet(); cfgSheet(); secret();
  if (!ADMIN_SDT || !ADMIN_MK) { Logger.log('⚠️ Hãy điền ADMIN_SDT và ADMIN_MK ở đầu file, lưu, rồi chạy lại caiDat.'); return; }
  const p = normPhone(ADMIN_SDT); checkPhone(p); checkPw(ADMIN_MK);
  const a = findAcc(p);
  if (a) { accSheet().getRange(a.row, 4, 1, 2).setValues([['admin', 'active']]); setPw(a, ADMIN_MK); }
  else createAcc(p, ADMIN_MK, 'admin', 'Quản trị viên');
  Logger.log('✅ Đã sẵn sàng. Tài khoản admin: ' + p);
}
