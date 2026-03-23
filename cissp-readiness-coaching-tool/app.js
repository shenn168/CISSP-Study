const DB_NAME = "cisspReadinessCoachDB";
const DB_VERSION = 1;
const STORE_MEMBERS = "members";
const STORE_JOURNAL = "journal";
const STORE_SETTINGS = "settings";

const DEFAULT_WEIGHTS = {
  experience: 15,
  discipline: 20,
  coverage: 15,
  practice: 25,
  domainBalance: 10,
  mindset: 10,
  execution: 5
};

const DEFAULT_SETTINGS = {
  weights: DEFAULT_WEIGHTS,
  theme: "dark",
  pin: null
};

let db = null;
let appState = {
  members: [],
  journal: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  selectedCohort: "all",
  currentMemberId: null
};

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr + "T00:00:00");
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function average(arr) {
  const vals = arr.filter(v => typeof v === "number" && !Number.isNaN(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function clamp(num, min, max) {
  return Math.min(max, Math.max(min, num));
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = event => {
      const dbInstance = event.target.result;

      if (!dbInstance.objectStoreNames.contains(STORE_MEMBERS)) {
        const members = dbInstance.createObjectStore(STORE_MEMBERS, { keyPath: "id" });
        members.createIndex("cohort", "cohort", { unique: false });
      }

      if (!dbInstance.objectStoreNames.contains(STORE_JOURNAL)) {
        const journal = dbInstance.createObjectStore(STORE_JOURNAL, { keyPath: "id" });
        journal.createIndex("memberId", "memberId", { unique: false });
        journal.createIndex("entryDate", "entryDate", { unique: false });
      }

      if (!dbInstance.objectStoreNames.contains(STORE_SETTINGS)) {
        dbInstance.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(storeName, mode = "readonly") {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function put(storeName, value) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName, "readwrite").put(value);
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}

function remove(storeName, key) {
  return new Promise((resolve, reject) => {
    const req = tx(storeName, "readwrite").delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function loadState() {
  appState.members = await getAll(STORE_MEMBERS);
  appState.journal = await getAll(STORE_JOURNAL);

  const settingsRows = await getAll(STORE_SETTINGS);
  const settings = settingsRows.find(s => s.key === "appSettings");
  appState.settings = settings?.value ? { ...DEFAULT_SETTINGS, ...settings.value } : structuredClone(DEFAULT_SETTINGS);
}

async function saveSettings() {
  await put(STORE_SETTINGS, {
    key: "appSettings",
    value: appState.settings
  });
}

function getMembersByFilter() {
  if (appState.selectedCohort === "all") return [...appState.members];
  return appState.members.filter(m => (m.cohort || "").trim() === appState.selectedCohort);
}

function getMemberJournal(memberId) {
  return appState.journal
    .filter(j => j.memberId === memberId)
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));
}

function getLatestEntry(memberId) {
  return getMemberJournal(memberId)[0] || null;
}

function parseTags(tags) {
  if (!tags) return [];
  return tags.split(",").map(t => t.trim()).filter(Boolean);
}

function inferCoverageScore(entries) {
  const text = entries.map(e => (e.materialsCovered || "").toLowerCase()).join(" ");
  let score = 0;
  if (text.includes("osg") || text.includes("official study guide")) score += 4;
  if (text.includes("all-in-one")) score += 3;
  if (text.includes("learnzapp")) score += 3;
  if (text.includes("boson")) score += 2;
  if (text.includes("pete zerger")) score += 1.5;
  if (text.includes("destination certification")) score += 1.5;
  if (text.includes("mike chapple")) score += 1.5;
  if (text.includes("practice exam")) score += 1;
  if (text.includes("review")) score += 1;
  return clamp(Math.round(score), 0, 15);
}

function computeExperienceScore(member) {
  const yearsIT = Number(member.yearsIT || 0);
  const yearsSecurity = Number(member.yearsSecurity || 0);
  let score = 0;

  if (yearsIT >= 10) score += 6;
  else if (yearsIT >= 5) score += 4;
  else if (yearsIT >= 2) score += 2;

  if (yearsSecurity >= 7) score += 5;
  else if (yearsSecurity >= 4) score += 4;
  else if (yearsSecurity >= 2) score += 2;

  const roleText = `${member.currentRole || ""} ${member.backgroundSummary || ""}`.toLowerCase();
  if (
    roleText.includes("manager") ||
    roleText.includes("lead") ||
    roleText.includes("risk") ||
    roleText.includes("compliance") ||
    roleText.includes("governance") ||
    roleText.includes("architect")
  ) {
    score += 2;
  }

  if (member.managerialTechnicalRating === "balanced" || member.managerialTechnicalRating === "managerial") {
    score += 2;
  }

  return clamp(score, 0, appState.settings.weights.experience);
}

function computeDisciplineScore(entries) {
  if (!entries.length) return 0;
  const recent = entries.slice(0, 8);
  const avgHours = average(recent.map(e => Number(e.studyHours || 0))) || 0;
  const attendanceGood = recent.filter(e => e.attendanceStatus === "Attended" || e.attendanceStatus === "Self-study only").length;
  const activity = recent.filter(e =>
    Number(e.studyHours || 0) > 0 ||
    Number(e.practiceQuestionsCompleted || 0) > 0 ||
    (e.materialsCovered || "").trim()
  ).length;

  let score = 0;
  if (avgHours >= 8) score += 8;
  else if (avgHours >= 5) score += 6;
  else if (avgHours >= 3) score += 4;
  else if (avgHours > 0) score += 2;

  if (attendanceGood >= 6) score += 6;
  else if (attendanceGood >= 4) score += 4;
  else if (attendanceGood >= 2) score += 2;

  if (activity >= 6) score += 6;
  else if (activity >= 4) score += 4;
  else if (activity >= 2) score += 2;

  return clamp(score, 0, appState.settings.weights.discipline);
}

function computePracticeScore(entries) {
  if (!entries.length) return 0;
  const mixedAvg = average(entries.map(e => Number(e.firstAttemptMixedScore)).filter(v => !Number.isNaN(v)));
  const fullAvg = average(entries.map(e => Number(e.fullPracticeExamScore)).filter(v => !Number.isNaN(v)));
  const totalQ = entries.reduce((sum, e) => sum + Number(e.practiceQuestionsCompleted || 0), 0);

  let score = 0;
  const primary = mixedAvg ?? fullAvg ?? 0;

  if (primary >= 85) score += 16;
  else if (primary >= 80) score += 14;
  else if (primary >= 75) score += 12;
  else if (primary >= 70) score += 9;
  else if (primary >= 65) score += 6;
  else if (primary > 0) score += 3;

  if (fullAvg !== null) {
    if (fullAvg >= 80) score += 5;
    else if (fullAvg >= 75) score += 4;
    else if (fullAvg >= 70) score += 3;
    else if (fullAvg >= 65) score += 2;
    else if (fullAvg > 0) score += 1;
  }

  if (totalQ >= 2000) score += 4;
  else if (totalQ >= 1000) score += 3;
  else if (totalQ >= 500) score += 2;
  else if (totalQ >= 100) score += 1;

  return clamp(score, 0, appState.settings.weights.practice);
}

function getDomainValues(entries) {
  const domains = [1, 2, 3, 4, 5, 6, 7, 8].map(n => {
    const vals = entries
      .map(e => Number(e[`d${n}`]))
      .filter(v => !Number.isNaN(v) && v >= 0);
    return {
      domain: n,
      average: average(vals),
      latest: vals.length ? vals[vals.length - 1] : null
    };
  });
  return domains;
}

function computeDomainBalanceScore(entries) {
  const domains = getDomainValues(entries).map(d => d.average).filter(v => v !== null);
  if (!domains.length) return 0;

  const minDomain = Math.min(...domains);
  const avgDomain = average(domains) || 0;

  let score = 0;
  if (minDomain >= 80 && avgDomain >= 80) score = 10;
  else if (minDomain >= 75 && avgDomain >= 75) score = 8;
  else if (minDomain >= 70 && avgDomain >= 72) score = 6;
  else if (minDomain >= 65) score = 4;
  else if (minDomain > 0) score = 2;

  return clamp(score, 0, appState.settings.weights.domainBalance);
}

function computeMindsetScore(entries) {
  if (!entries.length) return 0;
  const avgScore = average(entries.map(e => Number(e.managerialReasoningScore)).filter(v => !Number.isNaN(v)));
  if (avgScore === null) return 0;

  const maxWeight = appState.settings.weights.mindset;
  return clamp(Math.round((avgScore / 10) * maxWeight), 0, maxWeight);
}

function computeExecutionScore(entries, member) {
  const manualAvg = average(entries.map(e => Number(e.examExecutionScore)).filter(v => !Number.isNaN(v)));
  const confidenceAvg = average(entries.map(e => Number(e.confidenceRating)).filter(v => !Number.isNaN(v)));
  const fallbackConfidence = Number(member.initialConfidence || 0);

  const raw = manualAvg !== null
    ? manualAvg
    : confidenceAvg !== null
      ? confidenceAvg
      : fallbackConfidence;

  const scaleBase = 5;
  const maxWeight = appState.settings.weights.execution;

  if (!raw) return 0;
  return clamp(Math.round((raw / scaleBase) * maxWeight), 0, maxWeight);
}

function computeCoverageScore(entries) {
  const raw = inferCoverageScore(entries);
  return clamp(raw, 0, appState.settings.weights.coverage);
}

function computeReadiness(member) {
  const entries = getMemberJournal(member.id);
  const weights = appState.settings.weights;

  const experience = computeExperienceScore(member);
  const discipline = computeDisciplineScore(entries);
  const coverage = computeCoverageScore(entries);
  const practice = computePracticeScore(entries);
  const domainBalance = computeDomainBalanceScore(entries);
  const mindset = computeMindsetScore(entries);
  const execution = computeExecutionScore(entries, member);

  const total = experience + discipline + coverage + practice + domainBalance + mindset + execution;
  const maxPossible = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalized = Math.round((total / maxPossible) * 100);

  let band = "Red";
  if (normalized >= 85) band = "Green";
  else if (normalized >= 70) band = "Yellow";
  else if (normalized >= 55) band = "Orange";

  return {
    totalRaw: total,
    normalized,
    band,
    breakdown: {
      experience,
      discipline,
      coverage,
      practice,
      domainBalance,
      mindset,
      execution
    }
  };
}

function bandClass(band) {
  return band.toLowerCase();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setView(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  document.getElementById(viewId).classList.add("active");
  document.querySelector(`.nav-btn[data-view="${viewId}"]`)?.classList.add("active");

  const titleMap = {
    dashboardView: ["Dashboard", "Coach overview across cohorts and members"],
    membersView: ["Members", "Intake, readiness details, and member management"],
    journalView: ["Journal", "Coaching updates and member progress timeline"],
    reportsView: ["Reports", "Export, import, and printable summaries"],
    settingsView: ["Settings", "Weights, theme, PIN, and app options"]
  };

  document.getElementById("pageTitle").textContent = titleMap[viewId][0];
  document.getElementById("pageSubtitle").textContent = titleMap[viewId][1];
}

function renderCohortOptions() {
  const cohorts = [...new Set(appState.members.map(m => (m.cohort || "").trim()).filter(Boolean))].sort();
  const selects = [
    document.getElementById("globalCohortFilter")
  ];

  selects.forEach(select => {
    const current = select.value || "all";
    select.innerHTML = `<option value="all">All Cohorts</option>` + cohorts.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    if ([...select.options].some(o => o.value === current)) {
      select.value = current;
    }
  });
}

function renderDashboard() {
  const members = getMembersByFilter();
  const scored = members.map(m => ({ member: m, readiness: computeReadiness(m), latestEntry: getLatestEntry(m.id) }));

  document.getElementById("statTotalMembers").textContent = members.length;
  document.getElementById("statGreen").textContent = scored.filter(s => s.readiness.band === "Green").length;
  document.getElementById("statYellow").textContent = scored.filter(s => s.readiness.band === "Yellow").length;
  document.getElementById("statOrange").textContent = scored.filter(s => s.readiness.band === "Orange").length;
  document.getElementById("statRed").textContent = scored.filter(s => s.readiness.band === "Red").length;

  const atRisk = scored
    .filter(s => s.readiness.normalized < 70)
    .sort((a, b) => a.readiness.normalized - b.readiness.normalized)
    .slice(0, 8);

  document.getElementById("atRiskList").innerHTML = atRisk.length
    ? atRisk.map(({ member, readiness }) => `
      <div class="list-item">
        <div><strong>${escapeHtml(member.fullName)}</strong></div>
        <div class="subtle-text">${escapeHtml(member.cohort || "No cohort")} · Score ${readiness.normalized}</div>
        <div class="badge ${bandClass(readiness.band)}">${readiness.band}</div>
      </div>
    `).join("")
    : `<div class="list-item subtle-text">No at-risk members in current filter.</div>`;

  const upcoming = scored
    .filter(s => s.member.targetExamDate)
    .sort((a, b) => new Date(a.member.targetExamDate) - new Date(b.member.targetExamDate))
    .slice(0, 8);

  document.getElementById("upcomingExamList").innerHTML = upcoming.length
    ? upcoming.map(({ member, readiness }) => {
      const days = daysUntil(member.targetExamDate);
      return `
        <div class="list-item">
          <div><strong>${escapeHtml(member.fullName)}</strong></div>
          <div class="subtle-text">${formatDate(member.targetExamDate)} · ${days} day(s)</div>
          <div class="badge ${bandClass(readiness.band)}">${readiness.band} · ${readiness.normalized}</div>
        </div>
      `;
    }).join("")
    : `<div class="list-item subtle-text">No upcoming exam dates.</div>`;

  const stale = members
    .map(m => {
      const latest = getLatestEntry(m.id);
      return { member: m, latest };
    })
    .filter(x => !x.latest || Math.abs(daysUntil(x.latest?.entryDate || "")) > 7)
    .slice(0, 8);

  document.getElementById("staleMembersList").innerHTML = stale.length
    ? stale.map(({ member, latest }) => `
      <div class="list-item">
        <div><strong>${escapeHtml(member.fullName)}</strong></div>
        <div class="subtle-text">${latest ? `Last update ${formatDate(latest.entryDate)}` : "No journal entries yet"}</div>
      </div>
    `).join("")
    : `<div class="list-item subtle-text">All members updated recently.</div>`;

  const domainBucket = [];
  members.forEach(member => {
    const entries = getMemberJournal(member.id);
    const domains = getDomainValues(entries);
    domains.forEach(d => {
      if (d.average !== null) {
        domainBucket.push({ domain: d.domain, average: d.average, memberName: member.fullName });
      }
    });
  });

  const weak = domainBucket
    .sort((a, b) => a.average - b.average)
    .slice(0, 8);

  document.getElementById("weakDomainsList").innerHTML = weak.length
    ? weak.map(w => `
      <div class="list-item">
        <div><strong>${escapeHtml(w.memberName)}</strong></div>
        <div class="subtle-text">Domain ${w.domain} · Average ${Math.round(w.average)}%</div>
      </div>
    `).join("")
    : `<div class="list-item subtle-text">No domain data available yet.</div>`;

  const recentActivity = appState.journal
    .filter(j => {
      if (appState.selectedCohort === "all") return true;
      const member = appState.members.find(m => m.id === j.memberId);
      return member && (member.cohort || "").trim() === appState.selectedCohort;
    })
    .sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate))
    .slice(0, 10);

  document.getElementById("recentActivityList").innerHTML = recentActivity.length
    ? recentActivity.map(entry => {
      const member = appState.members.find(m => m.id === entry.memberId);
      return `
        <div class="list-item">
          <div><strong>${escapeHtml(member?.fullName || "Unknown Member")}</strong></div>
          <div class="subtle-text">${formatDate(entry.entryDate)} · ${escapeHtml(entry.attendanceStatus || "")} · ${Number(entry.studyHours || 0)} hour(s)</div>
        </div>
      `;
    }).join("")
    : `<div class="list-item subtle-text">No recent journal activity.</div>`;

  renderReadinessBarChart(scored);
}

function renderReadinessBarChart(scored) {
  const canvas = document.getElementById("trendCanvas");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const displayWidth = canvas.clientWidth || 1100;
  const displayHeight = canvas.clientHeight || 360;

  canvas.width = Math.floor(displayWidth * dpr);
  canvas.height = Math.floor(displayHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const css = getComputedStyle(document.body);
  const bg = css.getPropertyValue("--panel-2").trim();
  const grid = css.getPropertyValue("--border").trim();
  const text = css.getPropertyValue("--muted").trim();
  const accent = css.getPropertyValue("--accent").trim();
  const success = css.getPropertyValue("--success").trim();
  const warn = css.getPropertyValue("--warn").trim();
  const orange = css.getPropertyValue("--orange").trim();
  const danger = css.getPropertyValue("--danger").trim();

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, displayWidth, displayHeight);

  const paddingTop = 24;
  const paddingRight = 24;
  const paddingBottom = 110;
  const paddingLeft = 52;

  const chartW = displayWidth - paddingLeft - paddingRight;
  const chartH = displayHeight - paddingTop - paddingBottom;

  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;

  for (let i = 0; i <= 5; i++) {
    const y = paddingTop + (chartH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(paddingLeft + chartW, y);
    ctx.stroke();
  }

  ctx.fillStyle = text;
  ctx.font = "12px Segoe UI";
  ctx.textAlign = "right";

  [100, 80, 60, 40, 20, 0].forEach((val, i) => {
    const y = paddingTop + (chartH / 5) * i + 4;
    ctx.fillText(String(val), paddingLeft - 8, y);
  });

  if (!scored.length) {
    ctx.textAlign = "left";
    ctx.fillText("No readiness data available", paddingLeft, paddingTop + 20);
    return;
  }

  const gap = 18;
  const slotWidth = chartW / scored.length;
  const barWidth = Math.max(24, Math.min(64, slotWidth - gap));

  scored.forEach((entry, idx) => {
    const score = entry.readiness.normalized;
    const x = paddingLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
    const barHeight = (score / 100) * chartH;
    const y = paddingTop + chartH - barHeight;

    let fill = accent;
    if (entry.readiness.band === "Green") fill = success;
    else if (entry.readiness.band === "Yellow") fill = warn;
    else if (entry.readiness.band === "Orange") fill = orange;
    else if (entry.readiness.band === "Red") fill = danger;

    ctx.fillStyle = fill;
    roundRect(ctx, x, y, barWidth, barHeight, 8, true, false);

    ctx.fillStyle = text;
    ctx.textAlign = "center";
    ctx.font = "12px Segoe UI";
    ctx.fillText(String(score), x + barWidth / 2, y - 8);

    const name = entry.member.fullName.length > 16
      ? `${entry.member.fullName.slice(0, 16)}…`
      : entry.member.fullName;

    const snapshotText = entry.latestEntry
      ? formatDate(entry.latestEntry.entryDate)
      : "No snapshot";

    ctx.save();
    ctx.translate(x + barWidth / 2, paddingTop + chartH + 18);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = text;
    ctx.font = "11px Segoe UI";
    ctx.fillText(name, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(x + barWidth / 2, paddingTop + chartH + 42);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = text;
    ctx.font = "10px Segoe UI";
    ctx.fillText(snapshotText, 0, 0);
    ctx.restore();
  });
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function renderMembers() {
  const search = document.getElementById("memberSearchInput").value.trim().toLowerCase();
  let members = getMembersByFilter();

  if (search) {
    members = members.filter(m =>
      [m.fullName, m.preferredName, m.currentRole, m.cohort]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }

  const html = members.length ? `
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Cohort</th>
          <th>Role</th>
          <th>Exam Date</th>
          <th>Readiness</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${members.map(m => {
          const r = computeReadiness(m);
          return `
            <tr>
              <td>
                <strong>${escapeHtml(m.fullName)}</strong><br />
                <span class="subtle-text">${escapeHtml(m.preferredName || "")}</span>
              </td>
              <td>${escapeHtml(m.cohort || "—")}</td>
              <td>${escapeHtml(m.currentRole || "—")}</td>
              <td>${formatDate(m.targetExamDate)}</td>
              <td>
                <div class="badge ${bandClass(r.band)}">${r.band}</div>
                <div class="subtle-text">Score ${r.normalized}</div>
              </td>
              <td>
                <div class="member-actions">
                  <button class="secondary-btn member-action-btn" data-action="view" data-id="${m.id}">View</button>
                  <button class="secondary-btn member-action-btn" data-action="edit" data-id="${m.id}">Edit</button>
                  <button class="ghost-btn member-action-btn" data-action="delete" data-id="${m.id}">Delete</button>
                </div>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  ` : `<div class="subtle-text">No members found.</div>`;

  document.getElementById("memberTableWrap").innerHTML = html;
  populateMemberSelects();
}

function renderMemberDetail(memberId) {
  const panel = document.getElementById("memberDetailPanel");
  const member = appState.members.find(m => m.id === memberId);
  if (!member) {
    panel.classList.add("hidden");
    return;
  }

  appState.currentMemberId = memberId;

  const readiness = computeReadiness(member);
  const entries = getMemberJournal(memberId);
  const latest = entries[0];
  const domains = getDomainValues(entries);

  panel.innerHTML = `
    <div class="panel-header">
      <h2>${escapeHtml(member.fullName)}</h2>
      <button class="ghost-btn" id="closeMemberDetailBtn">Close</button>
    </div>

    <div class="metric-grid">
      <div class="metric">
        <div class="metric-label">Readiness</div>
        <div class="metric-value">${readiness.normalized}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Band</div>
        <div class="metric-value ${bandClass(readiness.band)}">${readiness.band}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Target Exam</div>
        <div class="metric-value" style="font-size:16px;">${formatDate(member.targetExamDate)}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Last Update</div>
        <div class="metric-value" style="font-size:16px;">${latest ? formatDate(latest.entryDate) : "—"}</div>
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <h2>Member Profile</h2>
      <p><strong>Cohort:</strong> ${escapeHtml(member.cohort || "—")}</p>
      <p><strong>Role:</strong> ${escapeHtml(member.currentRole || "—")}</p>
      <p><strong>Years in IT:</strong> ${escapeHtml(member.yearsIT || "0")}</p>
      <p><strong>Years in Security:</strong> ${escapeHtml(member.yearsSecurity || "0")}</p>
      <p><strong>ISC2 Status:</strong> ${escapeHtml(member.isc2Status || "—")}</p>
      <p><strong>Managerial vs Technical:</strong> ${escapeHtml(member.managerialTechnicalRating || "—")}</p>
      <p><strong>Background:</strong> ${escapeHtml(member.backgroundSummary || "—")}</p>
      <p><strong>Notes:</strong> ${escapeHtml(member.memberNotes || "—")}</p>
    </div>

    <div class="card" style="margin-top:16px;">
      <h2>Readiness Breakdown</h2>
      <div class="metric-grid">
        <div class="metric"><div class="metric-label">Experience</div><div class="metric-value">${readiness.breakdown.experience}</div></div>
        <div class="metric"><div class="metric-label">Discipline</div><div class="metric-value">${readiness.breakdown.discipline}</div></div>
        <div class="metric"><div class="metric-label">Coverage</div><div class="metric-value">${readiness.breakdown.coverage}</div></div>
        <div class="metric"><div class="metric-label">Practice</div><div class="metric-value">${readiness.breakdown.practice}</div></div>
        <div class="metric"><div class="metric-label">Domain Balance</div><div class="metric-value">${readiness.breakdown.domainBalance}</div></div>
        <div class="metric"><div class="metric-label">Mindset</div><div class="metric-value">${readiness.breakdown.mindset}</div></div>
        <div class="metric"><div class="metric-label">Execution</div><div class="metric-value">${readiness.breakdown.execution}</div></div>
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <h2>Domain Averages</h2>
      <div class="metric-grid">
        ${domains.map(d => `
          <div class="metric">
            <div class="metric-label">Domain ${d.domain}</div>
            <div class="metric-value">${d.average !== null ? Math.round(d.average) + "%" : "—"}</div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <div class="panel-header">
        <h2>Journal Timeline</h2>
        <button class="primary-btn" id="detailAddJournalBtn" data-member-id="${member.id}">Add Entry</button>
      </div>
      <div class="timeline">
        ${entries.length ? entries.map(e => `
          <div class="timeline-item">
            <div><strong>${formatDate(e.entryDate)}</strong></div>
            <div class="subtle-text">${escapeHtml(e.attendanceStatus || "—")} · ${Number(e.studyHours || 0)} hour(s) · Mixed ${e.firstAttemptMixedScore || "—"}%</div>
            <div style="margin-top:8px;">${escapeHtml(e.coachObservations || "No coach observations.")}</div>
            <div class="subtle-text" style="margin-top:8px;">Next: ${escapeHtml(e.nextActions || "—")}</div>
          </div>
        `).join("") : `<div class="timeline-item subtle-text">No journal entries yet.</div>`}
      </div>
    </div>
  `;

  panel.classList.remove("hidden");

  document.getElementById("closeMemberDetailBtn").addEventListener("click", closeMemberDetail);
  document.getElementById("detailAddJournalBtn").addEventListener("click", () => startJournalForMember(member.id));
}

function renderJournal() {
  const memberId = document.getElementById("journalMemberFilter").value;
  let entries = [...appState.journal].sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));

  if (memberId) {
    entries = entries.filter(e => e.memberId === memberId);
  } else if (appState.selectedCohort !== "all") {
    const memberIds = new Set(getMembersByFilter().map(m => m.id));
    entries = entries.filter(e => memberIds.has(e.memberId));
  }

  document.getElementById("journalTimeline").innerHTML = entries.length
    ? entries.map(e => {
      const member = appState.members.find(m => m.id === e.memberId);
      return `
        <div class="timeline-item">
          <div><strong>${escapeHtml(member?.fullName || "Unknown Member")}</strong> · ${formatDate(e.entryDate)}</div>
          <div class="subtle-text">${escapeHtml(e.attendanceStatus || "—")} · ${Number(e.studyHours || 0)} hour(s) · ${Number(e.practiceQuestionsCompleted || 0)} questions</div>
          <div style="margin-top:8px;"><strong>Materials:</strong> ${escapeHtml(e.materialsCovered || "—")}</div>
          <div style="margin-top:8px;"><strong>Coach Observations:</strong> ${escapeHtml(e.coachObservations || "—")}</div>
          <div class="subtle-text" style="margin-top:8px;">Tags: ${escapeHtml((e.tags || []).join(", ") || "—")}</div>
        </div>
      `;
    }).join("")
    : `<div class="timeline-item subtle-text">No journal entries found.</div>`;
}

function populateMemberSelects() {
  const options = `<option value="">Select Member</option>` + appState.members
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map(m => `<option value="${m.id}">${escapeHtml(m.fullName)}</option>`)
    .join("");

  ["journalMemberFilter", "journalMemberId", "printMemberSelect"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = options;
    if ([...el.options].some(o => o.value === current)) el.value = current;
  });
}

function renderReports() {
  populateMemberSelects();
}

function renderSettings() {
  const w = appState.settings.weights;
  document.getElementById("wExperience").value = w.experience;
  document.getElementById("wDiscipline").value = w.discipline;
  document.getElementById("wCoverage").value = w.coverage;
  document.getElementById("wPractice").value = w.practice;
  document.getElementById("wDomainBalance").value = w.domainBalance;
  document.getElementById("wMindset").value = w.mindset;
  document.getElementById("wExecution").value = w.execution;
  document.getElementById("themeSelect").value = appState.settings.theme || "dark";
}

function refreshAll() {
  renderCohortOptions();
  renderDashboard();
  renderMembers();
  renderJournal();
  renderReports();
  renderSettings();
}

function resetMemberForm() {
  document.getElementById("memberForm").reset();
  document.getElementById("memberId").value = "";
  document.getElementById("memberFormTitle").textContent = "Add Member";
}

function openMemberForm() {
  resetMemberForm();
  document.getElementById("memberFormPanel").classList.remove("hidden");
}

function closeMemberForm() {
  document.getElementById("memberFormPanel").classList.add("hidden");
}

function editMember(id) {
  const m = appState.members.find(x => x.id === id);
  if (!m) return;
  document.getElementById("memberFormTitle").textContent = "Edit Member";
  document.getElementById("memberId").value = m.id;
  document.getElementById("fullName").value = m.fullName || "";
  document.getElementById("preferredName").value = m.preferredName || "";
  document.getElementById("cohort").value = m.cohort || "";
  document.getElementById("targetExamDate").value = m.targetExamDate || "";
  document.getElementById("currentRole").value = m.currentRole || "";
  document.getElementById("yearsIT").value = m.yearsIT || "";
  document.getElementById("yearsSecurity").value = m.yearsSecurity || "";
  document.getElementById("isc2Status").value = m.isc2Status || "";
  document.getElementById("managerialTechnicalRating").value = m.managerialTechnicalRating || "";
  document.getElementById("initialConfidence").value = m.initialConfidence || "";
  document.getElementById("backgroundSummary").value = m.backgroundSummary || "";
  document.getElementById("memberNotes").value = m.memberNotes || "";
  document.getElementById("memberFormPanel").classList.remove("hidden");
  setView("membersView");
}

async function deleteMember(id) {
  const ok = confirm("Delete this member and all related journal entries?");
  if (!ok) return;

  const journalEntries = appState.journal.filter(j => j.memberId === id);
  for (const entry of journalEntries) {
    await remove(STORE_JOURNAL, entry.id);
  }
  await remove(STORE_MEMBERS, id);

  await loadState();
  refreshAll();
  closeMemberDetail();
}

function openMemberDetail(id) {
  setView("membersView");
  renderMemberDetail(id);
}

function closeMemberDetail() {
  document.getElementById("memberDetailPanel").classList.add("hidden");
}

function resetJournalForm() {
  document.getElementById("journalForm").reset();
  document.getElementById("journalId").value = "";
  document.getElementById("journalFormTitle").textContent = "New Journal Entry";
  document.getElementById("entryDate").value = new Date().toISOString().slice(0, 10);
}

function openJournalForm(memberId = "") {
  resetJournalForm();
  document.getElementById("journalFormPanel").classList.remove("hidden");
  if (memberId) {
    document.getElementById("journalMemberId").value = memberId;
  }
}

function closeJournalForm() {
  document.getElementById("journalFormPanel").classList.add("hidden");
}

function startJournalForMember(memberId) {
  setView("journalView");
  openJournalForm(memberId);
}

function collectDomainValues() {
  const out = {};
  for (let i = 1; i <= 8; i++) {
    const val = document.getElementById(`d${i}`).value;
    out[`d${i}`] = val === "" ? null : Number(val);
  }
  return out;
}

function buildMemberCsv(members) {
  const headers = [
    "fullName",
    "preferredName",
    "cohort",
    "targetExamDate",
    "currentRole",
    "yearsIT",
    "yearsSecurity",
    "backgroundSummary",
    "isc2Status",
    "managerialTechnicalRating",
    "initialConfidence",
    "memberNotes"
  ];

  const rows = [
    headers.join(","),
    ...members.map(m => headers.map(h => csvEscape(m[h] ?? "")).join(","))
  ];

  return rows.join("\n");
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeExportData() {
  return {
    members: appState.members.map(m => ({
      ...m,
      memberNotes: ""
    })),
    journal: appState.journal.map(j => ({
      ...j,
      coachObservations: "",
      blockers: "",
      nextActions: ""
    })),
    settings: {
      ...appState.settings,
      pin: null
    }
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter(r => r.some(c => c.trim() !== ""));
}

async function importMembersFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    alert("CSV does not contain member rows.");
    return;
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  for (const row of dataRows) {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] ?? "";
    });

    const member = {
      id: uid("member"),
      fullName: obj.fullName || "",
      preferredName: obj.preferredName || "",
      cohort: obj.cohort || "",
      targetExamDate: obj.targetExamDate || "",
      currentRole: obj.currentRole || "",
      yearsIT: obj.yearsIT ? Number(obj.yearsIT) : "",
      yearsSecurity: obj.yearsSecurity ? Number(obj.yearsSecurity) : "",
      backgroundSummary: obj.backgroundSummary || "",
      isc2Status: obj.isc2Status || "",
      managerialTechnicalRating: obj.managerialTechnicalRating || "",
      initialConfidence: obj.initialConfidence || "",
      memberNotes: obj.memberNotes || "",
      createdAt: new Date().toISOString()
    };

    await put(STORE_MEMBERS, member);
  }

  await loadState();
  refreshAll();
  alert("CSV import complete.");
}

async function importFullJson(text) {
  const parsed = JSON.parse(text);
  const members = Array.isArray(parsed.members) ? parsed.members : [];
  const journal = Array.isArray(parsed.journal) ? parsed.journal : [];
  const settings = parsed.settings || null;

  for (const m of members) {
    if (!m.id) m.id = uid("member");
    await put(STORE_MEMBERS, m);
  }

  for (const j of journal) {
    if (!j.id) j.id = uid("journal");
    await put(STORE_JOURNAL, j);
  }

  if (settings) {
    appState.settings = { ...DEFAULT_SETTINGS, ...settings };
    await saveSettings();
  }

  await loadState();
  applyTheme();
  refreshAll();
  alert("JSON import complete.");
}

function printMemberSummary(memberId) {
  const member = appState.members.find(m => m.id === memberId);
  if (!member) {
    alert("Select a member first.");
    return;
  }

  const readiness = computeReadiness(member);
  const entries = getMemberJournal(memberId);
  const domains = getDomainValues(entries);

  const win = window.open("", "_blank", "width=1000,height=800");
  win.document.write(`
    <html>
      <head>
        <title>${escapeHtml(member.fullName)} - CISSP Summary</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1, h2 { margin-bottom: 8px; }
          .section { margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .card { border: 1px solid #ccc; border-radius: 8px; padding: 12px; }
          .small { color: #555; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(member.fullName)}</h1>
        <div class="small">CISSP Readiness and Coaching Tool</div>

        <div class="section">
          <h2>Profile</h2>
          <p><strong>Cohort:</strong> ${escapeHtml(member.cohort || "—")}</p>
          <p><strong>Role:</strong> ${escapeHtml(member.currentRole || "—")}</p>
          <p><strong>Target Exam Date:</strong> ${formatDate(member.targetExamDate)}</p>
          <p><strong>Background:</strong> ${escapeHtml(member.backgroundSummary || "—")}</p>
        </div>

        <div class="section">
          <h2>Readiness</h2>
          <div class="grid">
            <div class="card"><strong>Score</strong><br />${readiness.normalized}</div>
            <div class="card"><strong>Band</strong><br />${readiness.band}</div>
            <div class="card"><strong>Last Update</strong><br />${entries[0] ? formatDate(entries[0].entryDate) : "—"}</div>
          </div>
        </div>

        <div class="section">
          <h2>Breakdown</h2>
          <div class="grid">
            <div class="card"><strong>Experience</strong><br />${readiness.breakdown.experience}</div>
            <div class="card"><strong>Discipline</strong><br />${readiness.breakdown.discipline}</div>
            <div class="card"><strong>Coverage</strong><br />${readiness.breakdown.coverage}</div>
            <div class="card"><strong>Practice</strong><br />${readiness.breakdown.practice}</div>
            <div class="card"><strong>Domain Balance</strong><br />${readiness.breakdown.domainBalance}</div>
            <div class="card"><strong>Mindset</strong><br />${readiness.breakdown.mindset}</div>
            <div class="card"><strong>Execution</strong><br />${readiness.breakdown.execution}</div>
          </div>
        </div>

        <div class="section">
          <h2>Domain Averages</h2>
          <div class="grid">
            ${domains.map(d => `<div class="card"><strong>Domain ${d.domain}</strong><br />${d.average !== null ? Math.round(d.average) + "%" : "—"}</div>`).join("")}
          </div>
        </div>

        <div class="section">
          <h2>Recent Journal Entries</h2>
          ${entries.slice(0, 10).map(e => `
            <div class="card" style="margin-bottom:10px;">
              <strong>${formatDate(e.entryDate)}</strong><br />
              <span class="small">${escapeHtml(e.attendanceStatus || "—")} · ${Number(e.studyHours || 0)} hour(s) · Mixed ${e.firstAttemptMixedScore || "—"}%</span>
              <p>${escapeHtml(e.coachObservations || "—")}</p>
            </div>
          `).join("")}
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function applyTheme() {
  document.body.setAttribute("data-theme", appState.settings.theme || "dark");
}

async function setPin(newPin) {
  appState.settings.pin = newPin;
  await saveSettings();
}

function showPinMessage(msg) {
  document.getElementById("pinMessage").textContent = msg;
}

function showPinSetup() {
  document.getElementById("pinHelpText").textContent = "Set a 4-digit PIN to secure local access.";
  document.getElementById("pinSetupSection").classList.remove("hidden");
  document.getElementById("pinUnlockSection").classList.add("hidden");
}

function showPinUnlock() {
  document.getElementById("pinHelpText").textContent = "Enter your 4-digit PIN to unlock the app.";
  document.getElementById("pinSetupSection").classList.add("hidden");
  document.getElementById("pinUnlockSection").classList.remove("hidden");
}

function unlockApp() {
  document.getElementById("pinOverlay").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
}

function lockApp() {
  document.getElementById("pinUnlockInput").value = "";
  document.getElementById("pinOverlay").classList.remove("hidden");
  document.getElementById("appShell").classList.add("hidden");
  showPinMessage("");
  showPinUnlock();
}

async function seedSampleData() {
  const existing = appState.members.length;
  if (existing) {
    const ok = confirm("Sample data will be added to existing data. Continue?");
    if (!ok) return;
  }

  const m1 = {
    id: uid("member"),
    fullName: "Jordan Lee",
    preferredName: "Jordan",
    cohort: "Spring 2026",
    targetExamDate: "2026-05-15",
    currentRole: "Security Analyst",
    yearsIT: 8,
    yearsSecurity: 5,
    backgroundSummary: "Blue team, incident response, IAM, security operations.",
    isc2Status: "meets",
    managerialTechnicalRating: "balanced",
    initialConfidence: "3",
    memberNotes: "Strong technical base, needs governance framing.",
    createdAt: new Date().toISOString()
  };

  const m2 = {
    id: uid("member"),
    fullName: "Taylor Morgan",
    preferredName: "Taylor",
    cohort: "Spring 2026",
    targetExamDate: "2026-06-10",
    currentRole: "IT Risk and Compliance Lead",
    yearsIT: 12,
    yearsSecurity: 7,
    backgroundSummary: "Risk management, audits, policy, third-party assessment.",
    isc2Status: "meets",
    managerialTechnicalRating: "managerial",
    initialConfidence: "4",
    memberNotes: "Needs more technical review in domains 3 and 4.",
    createdAt: new Date().toISOString()
  };

  await put(STORE_MEMBERS, m1);
  await put(STORE_MEMBERS, m2);

  const entries = [
    {
      id: uid("journal"),
      memberId: m1.id,
      entryDate: "2026-03-01",
      studyHours: 6,
      attendanceStatus: "Attended",
      materialsCovered: "OSG chapter review, LearnZapp, Pete Zerger exam cram",
      practiceQuestionsCompleted: 220,
      firstAttemptMixedScore: 72,
      fullPracticeExamScore: 70,
      confidenceRating: 3,
      managerialReasoningScore: 6,
      examExecutionScore: 3,
      d1: 74, d2: 70, d3: 68, d4: 66, d5: 75, d6: 78, d7: 73, d8: 76,
      coachObservations: "Improving, but still selecting overly technical answers.",
      blockers: "Overthinks long scenario questions.",
      nextActions: "Focus on manager lens and domain 3 review.",
      tags: ["mindset", "weak-domain"]
    },
    {
      id: uid("journal"),
      memberId: m1.id,
      entryDate: "2026-03-15",
      studyHours: 8,
      attendanceStatus: "Attended",
      materialsCovered: "Destination Certification review, LearnZapp mixed quiz",
      practiceQuestionsCompleted: 320,
      firstAttemptMixedScore: 78,
      fullPracticeExamScore: 76,
      confidenceRating: 4,
      managerialReasoningScore: 7,
      examExecutionScore: 4,
      d1: 78, d2: 74, d3: 72, d4: 70, d5: 79, d6: 80, d7: 76, d8: 80,
      coachObservations: "Trend is positive and reasoning has improved.",
      blockers: "",
      nextActions: "Keep mixed sets and decision-making drills.",
      tags: ["progress"]
    },
    {
      id: uid("journal"),
      memberId: m2.id,
      entryDate: "2026-03-08",
      studyHours: 5,
      attendanceStatus: "Self-study only",
      materialsCovered: "Mike Chapple course, OSG, Boson practice questions",
      practiceQuestionsCompleted: 180,
      firstAttemptMixedScore: 75,
      fullPracticeExamScore: 72,
      confidenceRating: 4,
      managerialReasoningScore: 8,
      examExecutionScore: 4,
      d1: 84, d2: 82, d3: 65, d4: 67, d5: 80, d6: 81, d7: 79, d8: 78,
      coachObservations: "Strong governance lens, but technical depth uneven.",
      blockers: "Domain 3 and 4 confidence.",
      nextActions: "Target technical domain review and diagrams.",
      tags: ["technical-gap"]
    }
  ];

  for (const e of entries) {
    await put(STORE_JOURNAL, e);
  }

  await loadState();
  refreshAll();
  alert("Sample data loaded.");
}

function bindMemberActionDelegation() {
  const wrap = document.getElementById("memberTableWrap");
  wrap.addEventListener("click", async event => {
    const btn = event.target.closest(".member-action-btn");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!action || !id) return;

    if (action === "view") {
      openMemberDetail(id);
      return;
    }

    if (action === "edit") {
      editMember(id);
      return;
    }

    if (action === "delete") {
      await deleteMember(id);
    }
  });
}

async function initEvents() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  document.getElementById("globalCohortFilter").addEventListener("change", e => {
    appState.selectedCohort = e.target.value;
    refreshAll();
  });

  document.getElementById("quickAddMemberBtn").addEventListener("click", () => {
    setView("membersView");
    openMemberForm();
  });

  document.getElementById("addMemberBtn").addEventListener("click", openMemberForm);
  document.getElementById("closeMemberFormBtn").addEventListener("click", closeMemberForm);

  document.getElementById("memberSearchInput").addEventListener("input", renderMembers);

  document.getElementById("memberForm").addEventListener("submit", async e => {
    e.preventDefault();

    const id = document.getElementById("memberId").value || uid("member");
    const member = {
      id,
      fullName: document.getElementById("fullName").value.trim(),
      preferredName: document.getElementById("preferredName").value.trim(),
      cohort: document.getElementById("cohort").value.trim(),
      targetExamDate: document.getElementById("targetExamDate").value,
      currentRole: document.getElementById("currentRole").value.trim(),
      yearsIT: document.getElementById("yearsIT").value ? Number(document.getElementById("yearsIT").value) : "",
      yearsSecurity: document.getElementById("yearsSecurity").value ? Number(document.getElementById("yearsSecurity").value) : "",
      isc2Status: document.getElementById("isc2Status").value,
      managerialTechnicalRating: document.getElementById("managerialTechnicalRating").value,
      initialConfidence: document.getElementById("initialConfidence").value,
      backgroundSummary: document.getElementById("backgroundSummary").value.trim(),
      memberNotes: document.getElementById("memberNotes").value.trim(),
      createdAt: new Date().toISOString()
    };

    await put(STORE_MEMBERS, member);
    await loadState();
    refreshAll();
    closeMemberForm();
  });

  document.getElementById("newJournalEntryBtn").addEventListener("click", () => openJournalForm());
  document.getElementById("closeJournalFormBtn").addEventListener("click", closeJournalForm);

  document.getElementById("journalMemberFilter").addEventListener("change", renderJournal);

  document.getElementById("journalForm").addEventListener("submit", async e => {
    e.preventDefault();

    const id = document.getElementById("journalId").value || uid("journal");
    const entry = {
      id,
      memberId: document.getElementById("journalMemberId").value,
      entryDate: document.getElementById("entryDate").value,
      studyHours: document.getElementById("studyHours").value ? Number(document.getElementById("studyHours").value) : 0,
      attendanceStatus: document.getElementById("attendanceStatus").value,
      materialsCovered: document.getElementById("materialsCovered").value.trim(),
      practiceQuestionsCompleted: document.getElementById("practiceQuestionsCompleted").value ? Number(document.getElementById("practiceQuestionsCompleted").value) : 0,
      firstAttemptMixedScore: document.getElementById("firstAttemptMixedScore").value ? Number(document.getElementById("firstAttemptMixedScore").value) : null,
      fullPracticeExamScore: document.getElementById("fullPracticeExamScore").value ? Number(document.getElementById("fullPracticeExamScore").value) : null,
      confidenceRating: document.getElementById("confidenceRating").value ? Number(document.getElementById("confidenceRating").value) : null,
      managerialReasoningScore: document.getElementById("managerialReasoningScore").value ? Number(document.getElementById("managerialReasoningScore").value) : null,
      examExecutionScore: document.getElementById("examExecutionScore").value ? Number(document.getElementById("examExecutionScore").value) : null,
      ...collectDomainValues(),
      coachObservations: document.getElementById("coachObservations").value.trim(),
      blockers: document.getElementById("blockers").value.trim(),
      nextActions: document.getElementById("nextActions").value.trim(),
      tags: parseTags(document.getElementById("tags").value)
    };

    if (!entry.memberId) {
      alert("Select a member.");
      return;
    }

    await put(STORE_JOURNAL, entry);
    await loadState();
    refreshAll();
    closeJournalForm();

    if (appState.currentMemberId === entry.memberId) {
      renderMemberDetail(entry.memberId);
    }
  });

  document.getElementById("exportJsonBtn").addEventListener("click", () => {
    const data = {
      members: appState.members,
      journal: appState.journal,
      settings: appState.settings
    };
    downloadFile("cissp-readiness-data.json", JSON.stringify(data, null, 2), "application/json");
  });

  document.getElementById("exportSafeJsonBtn").addEventListener("click", () => {
    downloadFile("cissp-readiness-safe-export.json", JSON.stringify(safeExportData(), null, 2), "application/json");
  });

  document.getElementById("exportCsvBtn").addEventListener("click", () => {
    downloadFile("cissp-members.csv", buildMemberCsv(appState.members), "text/csv");
  });

  document.getElementById("importCsvInput").addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importMembersFromCsv(text);
    e.target.value = "";
  });

  document.getElementById("importJsonInput").addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await importFullJson(text);
    e.target.value = "";
  });

  document.getElementById("printMemberSummaryBtn").addEventListener("click", () => {
    printMemberSummary(document.getElementById("printMemberSelect").value);
  });

  document.getElementById("weightsForm").addEventListener("submit", async e => {
    e.preventDefault();

    const weights = {
      experience: Number(document.getElementById("wExperience").value || 0),
      discipline: Number(document.getElementById("wDiscipline").value || 0),
      coverage: Number(document.getElementById("wCoverage").value || 0),
      practice: Number(document.getElementById("wPractice").value || 0),
      domainBalance: Number(document.getElementById("wDomainBalance").value || 0),
      mindset: Number(document.getElementById("wMindset").value || 0),
      execution: Number(document.getElementById("wExecution").value || 0)
    };

    appState.settings.weights = weights;
    await saveSettings();
    refreshAll();
    alert("Weights saved.");
  });

  document.getElementById("changePinBtn").addEventListener("click", async () => {
    const newPin = prompt("Enter new 4-digit PIN:");
    if (!/^\d{4}$/.test(newPin || "")) {
      alert("PIN must be exactly 4 digits.");
      return;
    }
    await setPin(newPin);
    alert("PIN updated.");
  });

  document.getElementById("resetSampleDataBtn").addEventListener("click", seedSampleData);

  document.getElementById("themeSelect").addEventListener("change", async e => {
    appState.settings.theme = e.target.value;
    await saveSettings();
    applyTheme();
    refreshAll();
  });

  document.getElementById("lockAppBtn").addEventListener("click", lockApp);

  document.getElementById("setPinBtn").addEventListener("click", async () => {
    const pin = document.getElementById("pinSetupInput").value.trim();
    const confirmPin = document.getElementById("pinSetupConfirmInput").value.trim();

    if (!/^\d{4}$/.test(pin)) {
      showPinMessage("PIN must be exactly 4 digits.");
      return;
    }

    if (pin !== confirmPin) {
      showPinMessage("PIN values do not match.");
      return;
    }

    await setPin(pin);
    showPinMessage("");
    unlockApp();
  });

  document.getElementById("unlockBtn").addEventListener("click", () => {
    const pin = document.getElementById("pinUnlockInput").value.trim();
    if (pin === appState.settings.pin) {
      unlockApp();
    } else {
      showPinMessage("Incorrect PIN.");
    }
  });

  bindMemberActionDelegation();

  window.addEventListener("resize", () => {
    if (!document.getElementById("dashboardView").classList.contains("active")) return;
    const members = getMembersByFilter();
    const scored = members.map(m => ({ member: m, readiness: computeReadiness(m), latestEntry: getLatestEntry(m.id) }));
    renderReadinessBarChart(scored);
  });
}

async function initPinState() {
  if (!appState.settings.pin) {
    showPinSetup();
    document.getElementById("pinOverlay").classList.remove("hidden");
    document.getElementById("appShell").classList.add("hidden");
  } else {
    showPinUnlock();
    document.getElementById("pinOverlay").classList.remove("hidden");
    document.getElementById("appShell").classList.add("hidden");
  }
}

(async function init() {
  db = await openDB();
  await loadState();
  applyTheme();
  await initEvents();
  refreshAll();
  await initPinState();
})();