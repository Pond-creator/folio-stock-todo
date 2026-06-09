// ============================================================
// FOLIO STOCK - To Do List Web App
// Google Apps Script Backend
// ============================================================

const SPREADSHEET_ID = '1kH_ZomGtVW9dc4g7NoT5GJliyNRp64xw0TZtEuHDZIg';

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const p = e.parameter;
    switch (p.action) {
      case 'login':    return respond(handleLogin(p.username, p.password));
      case 'getTasks': return respond(getTasks(p.username, p.role));
      case 'getSummary': return respond(getSummary());
      case 'getBase':  return respond(getBase());
      case 'getUsers': return respond(getUsers());
      default:         return respond({ error: 'Unknown action' });
    }
  } catch (err) {
    return respond({ error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    switch (data.action) {
      case 'addTask':        return respond(addTask(data));
      case 'updateTask':     return respond(updateTask(data));
      case 'deleteTask':     return respond(deleteTask(data));
      case 'updateAdminOrder': return respond(updateAdminOrder(data));
      case 'addBaseItem':    return respond(addBaseItem(data));
      case 'deleteBaseItem': return respond(deleteBaseItem(data));
      case 'addUser':        return respond(addUser(data));
      case 'deleteUser':     return respond(deleteUser(data));
      default:             return respond({ error: 'Unknown action' });
    }
  } catch (err) {
    return respond({ error: err.message });
  }
}

// ===== LOGIN =====
function handleLogin(username, password) {
  const sheet = getSheet('users');
  if (!sheet) return { success: false, message: 'ไม่พบ sheet users กรุณาสร้างก่อน' };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === String(username).trim().toLowerCase() &&
        String(rows[i][1]).trim() === String(password).trim()) {
      return {
        success: true,
        username: rows[i][0],
        role: rows[i][2],
        displayName: rows[i][3]
      };
    }
  }
  return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
}

// ===== TASKS =====
function getTasks(username, role) {
  const sheet = getSheet('to do list');
  const rows = sheet.getDataRange().getValues();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tasks = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[2]) continue;

    const assignTo = String(r[5] || '');
    if (role === 'user' && username) {
      const names = assignTo.split(',').map(s => s.trim());
      if (!names.includes(String(username).trim())) continue;
    }

    let daysLeft = null, isNearDeadline = false;
    if (r[6]) {
      const dl = new Date(r[6]); dl.setHours(0, 0, 0, 0);
      daysLeft = Math.ceil((dl - today) / 86400000);
      isNearDeadline = daysLeft <= 3 && daysLeft >= 0;
    }

    tasks.push({
      rowIndex:   i + 1,
      seq:        r[0],
      dateAdded:  fmtDate(r[1]),
      task:       String(r[2]).trim(),
      type:       r[3],
      priority:   r[4],
      assignTo:   assignTo,
      deadline:   fmtDate(r[6]),
      daysLeft:   daysLeft,
      adminOrder: r[7] !== '' && r[7] !== null && r[7] !== undefined ? Number(r[7]) : null,
      startDate:  fmtDate(r[8]),
      timeSlot:   r[9],
      doneDate:   fmtDate(r[10]),
      status:     r[11],
      percent:    fmtPercent(r[12]),
      addedBy:    r[13] || '',
      isNearDeadline: isNearDeadline
    });
  }
  return { success: true, tasks };
}

function addTask(d) {
  const sheet = getSheet('to do list');
  const seq = sheet.getLastRow(); // row 1 = header, so lastRow = count
  sheet.appendRow([
    seq, d.dateAdded, d.task, d.type, d.priority,
    d.assignTo, d.deadline, '', d.startDate || d.dateAdded,
    d.timeSlot, '', d.status || 'ยังไม่เริ่ม', d.percent || '0%',
    d.addedBy || ''
  ]);
  return { success: true };
}

function updateTask(d) {
  const sheet = getSheet('to do list');
  const ri = d.rowIndex;
  const updates = {
    3: d.task, 4: d.type, 5: d.priority, 6: d.assignTo,
    7: d.deadline, 10: d.timeSlot, 11: d.doneDate,
    12: d.status, 13: d.percent
  };
  Object.entries(updates).forEach(([col, val]) => {
    if (val !== undefined) sheet.getRange(ri, Number(col)).setValue(val);
  });
  return { success: true };
}

function deleteTask(d) {
  getSheet('to do list').deleteRow(d.rowIndex);
  return { success: true };
}

function updateAdminOrder(d) {
  // d.rowIndex, d.adminOrder (number or '' to clear)
  const sheet = getSheet('to do list');
  const val = (d.adminOrder === '' || d.adminOrder === null) ? '' : Number(d.adminOrder);
  sheet.getRange(d.rowIndex, 8).setValue(val); // column H
  return { success: true };
}

// ===== SUMMARY =====
function getSummary() {
  const sheet = getSheet('to do list');
  const rows = sheet.getDataRange().getValues();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let total = 0, done = 0, pending = 0, nearDeadline = 0;
  const byPerson = {}, byType = {};

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[2]) continue;
    total++;
    const isDone = r[11] === 'เสร็จเรียบร้อย' || r[12] === '100%';
    isDone ? done++ : pending++;

    if (!isDone && r[6]) {
      const dl = new Date(r[6]); dl.setHours(0, 0, 0, 0);
      if (Math.ceil((dl - today) / 86400000) <= 3) nearDeadline++;
    }

    String(r[5] || '').split(',').map(s => s.trim()).filter(Boolean).forEach(p => {
      if (!byPerson[p]) byPerson[p] = { total: 0, done: 0, pending: 0 };
      byPerson[p].total++;
      isDone ? byPerson[p].done++ : byPerson[p].pending++;
    });

    const t = r[3] || 'ไม่ระบุ';
    if (!byType[t]) byType[t] = { total: 0, done: 0, pending: 0 };
    byType[t].total++;
    isDone ? byType[t].done++ : byType[t].pending++;
  }
  return { success: true, total, done, pending, nearDeadline, byPerson, byType };
}

// ===== BASE =====
function getBase() {
  const sheet = getSheet('base');
  const rows = sheet.getDataRange().getValues();
  const base = { taskTypes: [], priorities: [], statuses: [], assignees: [], timeSlots: [] };
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) base.taskTypes.push(String(rows[i][0]));
    if (rows[i][2]) base.priorities.push(String(rows[i][2]));
    if (rows[i][4]) base.statuses.push({ label: String(rows[i][4]), percent: String(rows[i][5] || '') });
    if (rows[i][7]) base.assignees.push(String(rows[i][7]));
    if (rows[i][9]) base.timeSlots.push(String(rows[i][9]));
  }
  return { success: true, base };
}

function addBaseItem(d) {
  const sheet = getSheet('base');
  const colMap = { taskTypes: 1, priorities: 3, assignees: 8, timeSlots: 10 };
  const col = colMap[d.category];
  if (!col) return { success: false, message: 'Invalid category' };
  const colVals = sheet.getRange(2, col, sheet.getLastRow(), 1).getValues();
  let lastFilled = 1;
  for (let i = 0; i < colVals.length; i++) {
    if (colVals[i][0] !== '') lastFilled = i + 2;
  }
  sheet.getRange(lastFilled + 1, col).setValue(d.value);
  return { success: true };
}

function deleteBaseItem(d) {
  const sheet = getSheet('base');
  const colMap = { taskTypes: 1, priorities: 3, assignees: 8, timeSlots: 10 };
  const col = colMap[d.category];
  if (!col) return { success: false, message: 'Invalid category' };
  const colVals = sheet.getRange(2, col, sheet.getLastRow(), 1).getValues();
  for (let i = 0; i < colVals.length; i++) {
    if (String(colVals[i][0]).trim() === String(d.value).trim()) {
      sheet.getRange(i + 2, col).clearContent();
      return { success: true };
    }
  }
  return { success: false, message: 'ไม่พบรายการ' };
}

// ===== USERS =====
function getUsers() {
  const sheet = getSheet('users');
  if (!sheet) return { success: false, message: 'ไม่พบ sheet users' };
  const rows = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    users.push({ rowIndex: i + 1, username: rows[i][0], role: rows[i][2], displayName: rows[i][3] });
  }
  return { success: true, users };
}

function addUser(d) {
  const sheet = getSheet('users');
  // ตรวจสอบ username ซ้ำ
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toLowerCase() === String(d.username).trim().toLowerCase()) {
      return { success: false, message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' };
    }
  }
  sheet.appendRow([d.username, d.password, d.role, d.displayName]);
  return { success: true };
}

function deleteUser(d) {
  getSheet('users').deleteRow(d.rowIndex);
  return { success: true };
}

// ===== OT (legacy - ไม่ได้ใช้แล้ว แต่เก็บไว้) =====
function getOT() {
  const sheet = getSheet('lm ot');
  const rows = sheet.getDataRange().getValues();
  const otPlans = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    otPlans.push({ rowIndex: i + 1, date: fmtDate(rows[i][0]), timeRange: rows[i][1], lmCount: rows[i][2], job: rows[i][3] });
  }
  return { success: true, otPlans };
}

function addOT(d) {
  getSheet('lm ot').appendRow([d.date, d.timeRange, d.lmCount, d.job]);
  return { success: true };
}

function deleteOT(d) {
  getSheet('lm ot').deleteRow(d.rowIndex);
  return { success: true };
}

// ===== HELPER =====
function fmtPercent(v) {
  if (v === '' || v === null || v === undefined) return '0%';
  if (typeof v === 'number') return Math.round(v * 100) + '%';
  return String(v);
}

function fmtDate(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  try {
    const d = new Date(v);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return String(v); }
}
