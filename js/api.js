function fetchWithTimeout(url, options = {}, ms = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// ลองซ้ำอัตโนมัติเฉพาะ "อ่านข้อมูล" (GET) เท่านั้น — ปลอดภัยลองซ้ำได้เพราะไม่เขียนอะไร
// (ต่างจาก apiPost ที่ appendRow ถ้าลองซ้ำอาจสร้างงานซ้ำ จึงตั้งใจไม่ retry ฝั่งเขียนข้อมูล)
async function apiGet(params, retries = 1) {
  const url = new URL(CONFIG.API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // ครั้งแรกรอเต็ม 30 วิ (เผื่อช้าแต่จะสำเร็จ) / ครั้งลองซ้ำรอ 15 วิ
      // กันไม่ให้ผู้ใช้ต้องรอรวมนานเกินไปก่อนเห็น error — กรณีแย่สุด ~46 วิ
      const res = await fetchWithTimeout(url.toString(), { redirect: 'follow' }, attempt === 0 ? 30000 : 15000);
      if (!res.ok) throw new Error('Network error: ' + res.status);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise(r => setTimeout(r, 1200));
    }
  }
  throw lastErr;
}

// อ่าน username จาก session ที่ login ไว้ในเบราว์เซอร์ (key เดียวกับ auth.js)
function currentActor() {
  try {
    const u = JSON.parse(sessionStorage.getItem('folioUser'));
    return (u && u.username) ? u.username : '';
  } catch { return ''; }
}

async function apiPost(data) {
  const res = await fetchWithTimeout(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...data, actingUsername: currentActor() }),
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('Network error: ' + res.status);
  return res.json();
}

// ===== Shared helpers =====
const PRIORITY_CLASS = {
  'ด่วนมาก': 'badge-urgent',
  'ไม่เร่งด่วนแต่สำคัญ': 'badge-important',
  'ไม่สำคัญแต่เร่งด่วน': 'badge-rush',
  'ไม่่สำคัญแต่เร่งด่วน': 'badge-rush', // fallback สำหรับข้อมูลเก่าที่พิมพ์ผิด
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

// ===== เติมเลข % ให้ spinner ทุกหน้าอัตโนมัติ (ดูโหลดได้จริง ไม่ต้องแก้ทีละหน้า) =====
(function () {
  function enhance(el) {
    if (!el || el.dataset.pctEnhanced) return;
    el.dataset.pctEnhanced = '1';
    const pctSpan = document.createElement('span');
    pctSpan.className = 'load-pct';
    pctSpan.textContent = '0%';
    el.appendChild(pctSpan);
    let pct = 0;
    const timer = setInterval(() => {
      if (!el.isConnected) { clearInterval(timer); return; } // spinner ถูกแทนที่ด้วยข้อมูลจริงแล้ว
      pct += pct < 60 ? 7 : pct < 85 ? 3 : 1; // เร็วตอนแรก ช้าลงเมื่อใกล้เต็ม
      if (pct > 95) pct = 95; // ไม่วิ่งถึง 100 เอง รอข้อมูลจริงมาแทนที่
      pctSpan.textContent = pct + '%';
    }, 150);
  }
  function scan(root) {
    if (root.classList && root.classList.contains('loading')) enhance(root);
    if (root.querySelectorAll) root.querySelectorAll('.loading').forEach(enhance);
  }
  scan(document.body);
  new MutationObserver(muts => {
    muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) scan(n); }));
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
