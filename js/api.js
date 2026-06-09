function fetchWithTimeout(url, options = {}, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function apiGet(params) {
  const url = new URL(CONFIG.API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const res = await fetchWithTimeout(url.toString(), { redirect: 'follow' });
  if (!res.ok) throw new Error('Network error: ' + res.status);
  return res.json();
}

async function apiPost(data) {
  const res = await fetchWithTimeout(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('Network error: ' + res.status);
  return res.json();
}

// ===== Shared helpers =====
const PRIORITY_CLASS = {
  'ด่วนมาก': 'badge-urgent',
  'ไม่เร่งด่วนแต่สำคัญ': 'badge-important',
  'ไม่่สำคัญแต่เร่งด่วน': 'badge-rush',
  'ไม่สำคัญแต่เร่งด่วน': 'badge-rush',
  'รอได้ไม่สำคัญ': 'badge-low'
};
const STATUS_CLASS = {
  'ยังไม่เริ่ม': 'badge-not-started',
  'กำลังวางแผน': 'badge-planning',
  'ลงมือทำ': 'badge-doing',
  'ติดตามผล': 'badge-tracking',
  'เสร็จเรียบร้อย': 'badge-done'
};
const PERCENT_MAP = {
  'ยังไม่เริ่ม': '0%',
  'กำลังวางแผน': '25%',
  'ลงมือทำ': '50%',
  'ติดตามผล': '75%',
  'เสร็จเรียบร้อย': '100%'
};
const PERCENT_PROGRESS = { '0%': 'p0', '25%': 'p25', '50%': 'p50', '75%': 'p75', '100%': 'p100' };

function badgePriority(p) {
  return `<span class="badge ${PRIORITY_CLASS[p] || 'badge-low'}">${p || '-'}</span>`;
}
function badgeStatus(s) {
  return `<span class="badge ${STATUS_CLASS[s] || 'badge-not-started'}">${s || 'ยังไม่เริ่ม'}</span>`;
}
function progressBar(pct) {
  const cls = PERCENT_PROGRESS[pct] || 'p0';
  const w = parseInt(pct) || 0;
  return `<div class="progress-wrap"><div class="progress-bar ${cls}" style="width:${w}%"></div></div><span style="font-size:12px;color:#64748B;margin-left:6px">${pct || '0%'}</span>`;
}
function daysLeftHtml(days) {
  if (days === null || days === undefined || days === '') return '<span class="text-muted">-</span>';
  if (days < 0) return `<span class="days-critical">เกิน ${Math.abs(days)} วัน</span>`;
  if (days === 0) return `<span class="days-critical">วันนี้!</span>`;
  if (days <= 3) return `<span class="days-critical">${days} วัน</span>`;
  if (days <= 7) return `<span class="days-warning">${days} วัน</span>`;
  return `<span class="days-ok">${days} วัน</span>`;
}
function showLoading(id) {
  document.getElementById(id).innerHTML = '<div class="loading"><div class="spinner"></div> กำลังโหลด...</div>';
}
function showError(id, msg) {
  document.getElementById(id).innerHTML = `<div class="alert alert-danger">⚠️ ${msg}</div>`;
}
