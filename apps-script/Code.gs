/**
 * API đồng bộ cho app "Chi tiêu gia đình".
 * Dán toàn bộ file này vào Google Sheet > Tiện ích mở rộng > Apps Script.
 *
 * BƯỚC BẮT BUỘC: đổi MẬT KHẨU bên dưới thành mật khẩu riêng của gia đình bạn
 * (ít nhất 8 ký tự). Mật khẩu này sẽ nhập vào app trên mỗi điện thoại / máy tính.
 */
const MAT_KHAU = 'doi-mat-khau-nay-di';

const SHEET_TX = 'GiaoDich';
const SHEET_CFG = 'CauHinh';
const COLS = ['id', 'date', 'type', 'cat', 'amount', 'member', 'method', 'card', 'note', 'u', 'deleted', 'su', 'nhom', 'the'];
const HEADER = ['ID', 'Ngày', 'Loại', 'Mã nhóm', 'Số tiền', 'Thành viên', 'Thanh toán', 'Mã thẻ', 'Ghi chú', 'Sửa lúc', 'Đã xoá', 'Server', 'Tên nhóm', 'Tên thẻ'];

function doGet() {
  return out({ ok: true, msg: 'API chi tiêu gia đình đang chạy. Dán link này vào app để đồng bộ.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    if (MAT_KHAU === 'doi-mat-khau-nay-di' || MAT_KHAU.length < 8) return out({ ok: false, err: 'Chủ Sheet chưa đổi MAT_KHAU trong Apps Script (cần ≥ 8 ký tự).' });
    if (req.key !== MAT_KHAU) return out({ ok: false, err: 'Sai mật khẩu đồng bộ.' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = txSheet(ss);
    const now = Date.now();

    // ---- ghi giao dịch gửi lên (thắng nếu mới hơn) ----
    const data = sh.getDataRange().getValues();
    const idx = {};
    for (let i = 1; i < data.length; i++) idx[String(data[i][0])] = i;
    const appends = [];
    (req.tx || []).forEach(function (t) {
      if (!t || !t.id) return;
      const row = toRow(t, now);
      const i = idx[t.id];
      if (i === undefined) { appends.push(row); idx[t.id] = -1; }
      else if (i > 0 && Number(data[i][9]) <= Number(t.u || 0)) { sh.getRange(i + 1, 1, 1, COLS.length).setValues([row]); }
    });
    if (appends.length) {
      const last = sh.getLastRow();
      if (last + appends.length > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), last + appends.length - sh.getMaxRows() + 500);
      sh.getRange(last + 1, 1, appends.length, COLS.length).setNumberFormat('@').setValues(appends);
    }

    // ---- cấu hình (nhóm chi, hạn mức, thẻ...) : bản mới nhất thắng ----
    const cs = cfgSheet(ss);
    let cfg = null, cfgU = 0;
    const raw = cs.getRange('A1').getValue();
    if (raw) { try { const o = JSON.parse(raw); cfg = o.cfg; cfgU = Number(o.u) || 0; } catch (x) {} }
    if (req.cfg && (!cfg || (!req.first && Number(req.cfgU) > cfgU))) {
      cfg = req.cfg; cfgU = Number(req.cfgU) || now;
      cs.getRange('A1').setValue(JSON.stringify({ cfg: cfg, u: cfgU }));
    }

    // ---- trả về các dòng đổi sau lần đồng bộ trước ----
    const since = Number(req.since) || 0;
    const all = sh.getDataRange().getValues();
    const res = [];
    for (let i = 1; i < all.length; i++) if (Number(all[i][11]) > since) res.push(fromRow(all[i]));
    const sendCfg = req.first || cfgU > (Number(req.cfgU) || 0);
    return out({ ok: true, now: now, tx: res, cfg: sendCfg ? cfg : null, cfgU: cfgU });
  } catch (err) {
    return out({ ok: false, err: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function txSheet(ss) {
  let sh = ss.getSheetByName(SHEET_TX);
  if (!sh) {
    sh = ss.insertSheet(SHEET_TX);
    sh.getRange(1, 1, sh.getMaxRows(), COLS.length).setNumberFormat('@'); // giữ nguyên chữ, không tự đổi ngày
    sh.getRange(1, 1, 1, COLS.length).setValues([HEADER]).setFontWeight('bold').setBackground('#e8e6ff');
    sh.setFrozenRows(1);
  }
  return sh;
}
function cfgSheet(ss) {
  let sh = ss.getSheetByName(SHEET_CFG);
  if (!sh) { sh = ss.insertSheet(SHEET_CFG); sh.getRange('A1').setNumberFormat('@'); }
  return sh;
}
function toRow(t, now) {
  return [t.id, t.date || '', t.type || '', t.cat || '', String(t.amount || 0), t.member || '', t.method || '', t.card || '',
    t.note || '', String(t.u || now), t.deleted ? '1' : '', String(now), t.catName || '', t.cardName || ''];
}
function fromRow(r) {
  let d = r[1];
  if (d instanceof Date) d = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const o = { id: String(r[0]), date: String(d), type: String(r[2]), cat: String(r[3]), amount: Number(r[4]) || 0,
    member: String(r[5]), method: String(r[6]), note: String(r[8]), u: Number(r[9]) || 0 };
  if (r[7]) o.card = String(r[7]);
  if (String(r[10]) === '1') o.deleted = true;
  return o;
}
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Chạy thử hàm này 1 lần trong trình soạn Apps Script để cấp quyền và tạo sheet. */
function caiDat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  txSheet(ss); cfgSheet(ss);
  Logger.log(MAT_KHAU === 'doi-mat-khau-nay-di' ? '⚠️ Hãy đổi MAT_KHAU ở dòng đầu file!' : '✅ Đã tạo sheet GiaoDich và CauHinh.');
}
