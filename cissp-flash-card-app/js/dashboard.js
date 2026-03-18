/* ============================================================
   dashboard.js — Progress Dashboard (Phase 4)
   ============================================================ */

const Dashboard = (() => {

  async function init() {
    const container = document.getElementById('dashboardContent');
    const cards = await DB.getAllCards();
    const sessions = await DB.getAllSessions();
    const streakData = await DB.getSetting('streak');

    if (cards.length === 0) {
      container.innerHTML = `
        <div class="no-cards">
          <span class="no-cards-icon">&#x1F4CA;</span>
          <p>No data yet. Import cards and start studying to see your progress.</p>
          <button class="btn btn-primary" data-view="import">Import Deck</button>
        </div>
      `;
      return;
    }

    // Calculate stats
    const stats = calculateStats(cards, sessions, streakData);

    container.innerHTML = `
      <div class="dashboard-grid">
        ${buildOverviewCard(stats)}
        ${buildStreakCard(stats)}
        ${buildMasteryCard(stats)}
        ${buildDomainChart(stats)}
        ${buildWeakAreasCard(stats)}
        ${buildRecentSessionsCard(sessions)}
      </div>
    `;
  }

  function calculateStats(cards, sessions, streakData) {
    const stats = {
      totalCards: cards.length,
      dueToday: 0,
      mastered: 0,
      learning: 0,
      reviewing: 0,
      newCards: 0,
      flagged: 0,
      currentStreak: streakData ? streakData.current : 0,
      longestStreak: streakData ? streakData.longest : 0,
      domains: {},
      totalReviews: 0,
      totalKnow: 0,
      totalUnsure: 0,
      totalDontKnow: 0
    };

    Utils.DOMAINS.forEach(d => {
      stats.domains[d.name] = {
        total: 0,
        mastered: 0,
        learning: 0,
        reviewing: 0,
        newCards: 0,
        know: 0,
        unsure: 0,
        dontknow: 0
      };
    });

    cards.forEach(card => {
      const tier = Utils.getMasteryTier(card);
      const due = Utils.isDueToday(card);

      if (due) stats.dueToday++;
      if (card.flagged) stats.flagged++;

      switch (tier) {
        case 'mastered': stats.mastered++; break;
        case 'learning': stats.learning++; break;
        case 'reviewing': stats.reviewing++; break;
        case 'new': stats.newCards++; break;
      }

      if (stats.domains[card.domain]) {
        stats.domains[card.domain].total++;
        stats.domains[card.domain][tier === 'new' ? 'newCards' : tier]++;
      }

      card.reviewHistory.forEach(event => {
        stats.totalReviews++;
        if (event.quality === 'know') stats.totalKnow++;
        else if (event.quality === 'unsure') stats.totalUnsure++;
        else if (event.quality === 'dontknow') stats.totalDontKnow++;

        if (stats.domains[card.domain]) {
          if (event.quality === 'know') stats.domains[card.domain].know++;
          else if (event.quality === 'unsure') stats.domains[card.domain].unsure++;
          else if (event.quality === 'dontknow') stats.domains[card.domain].dontknow++;
        }
      });
    });

    return stats;
  }

  function buildOverviewCard(stats) {
    const accuracy = stats.totalReviews > 0
      ? Math.round((stats.totalKnow / stats.totalReviews) * 100)
      : 0;

    return `
      <div class="dash-card">
        <h3>&#x1F4CB; Overview</h3>
        <div class="summary-row"><span class="summary-label">Total Cards</span><span class="summary-value">${stats.totalCards}</span></div>
        <div class="summary-row"><span class="summary-label">Due Today</span><span class="summary-value" style="color:var(--accent-yellow)">${stats.dueToday}</span></div>
        <div class="summary-row"><span class="summary-label">Flagged</span><span class="summary-value" style="color:var(--accent-red)">${stats.flagged}</span></div>
        <div class="summary-row"><span class="summary-label">Total Reviews</span><span class="summary-value">${stats.totalReviews}</span></div>
        <div class="summary-row"><span class="summary-label">Overall Accuracy</span><span class="summary-value">${accuracy}%</span></div>
      </div>
    `;
  }

  function buildStreakCard(stats) {
    return `
      <div class="dash-card">
        <h3>&#x1F525; Study Streak</h3>
        <div style="text-align:center;padding:1rem 0">
          <span style="font-size:3rem;font-weight:700;color:var(--accent-primary);font-family:var(--font-mono)">${stats.currentStreak}</span>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-top:0.25rem">Current Streak (days)</div>
        </div>
        <div class="summary-row"><span class="summary-label">Longest Streak</span><span class="summary-value">${stats.longestStreak} days</span></div>
      </div>
    `;
  }

  function buildMasteryCard(stats) {
    const total = stats.totalCards || 1;
    const pctMastered = Math.round((stats.mastered / total) * 100);
    const pctReviewing = Math.round((stats.reviewing / total) * 100);
    const pctLearning = Math.round((stats.learning / total) * 100);
    const pctNew = Math.round((stats.newCards / total) * 100);

    return `
      <div class="dash-card">
        <h3>&#x1F3AF; Mastery Tiers</h3>
        <div class="bar-chart">
          <div class="bar-row">
            <span class="bar-label">Mastered</span>
            <div class="bar-track"><div class="bar-fill bar-fill-green" style="width:${pctMastered}%"></div></div>
            <span class="bar-value">${stats.mastered}</span>
          </div>
          <div class="bar-row">
            <span class="bar-label">Reviewing</span>
            <div class="bar-track"><div class="bar-fill bar-fill-blue" style="width:${pctReviewing}%"></div></div>
            <span class="bar-value">${stats.reviewing}</span>
          </div>
          <div class="bar-row">
            <span class="bar-label">Learning</span>
            <div class="bar-track"><div class="bar-fill bar-fill-yellow" style="width:${pctLearning}%"></div></div>
            <span class="bar-value">${stats.learning}</span>
          </div>
          <div class="bar-row">
            <span class="bar-label">New</span>
            <div class="bar-track"><div class="bar-fill bar-fill-purple" style="width:${pctNew}%"></div></div>
            <span class="bar-value">${stats.newCards}</span>
          </div>
        </div>
      </div>
    `;
  }

  function buildDomainChart(stats) {
    let barsHTML = '';

    Utils.DOMAINS.forEach(d => {
      const domainData = stats.domains[d.name];
      if (!domainData || domainData.total === 0) {
        barsHTML += `
          <div class="bar-row">
            <span class="bar-label">${d.num}. ${d.name}</span>
            <div class="bar-track"><div class="bar-fill bar-fill-blue" style="width:0%"></div></div>
            <span class="bar-value">0%</span>
          </div>
        `;
        return;
      }

      const pctMastered = Math.round((domainData.mastered / domainData.total) * 100);

      barsHTML += `
        <div class="bar-row">
          <span class="bar-label">${d.num}. ${d.name}</span>
          <div class="bar-track"><div class="bar-fill bar-fill-blue" style="width:${pctMastered}%"></div></div>
          <span class="bar-value">${pctMastered}%</span>
        </div>
      `;
    });

    return `
      <div class="dash-card" style="grid-column: 1 / -1">
        <h3>&#x1F4CA; Domain Mastery</h3>
        <div class="bar-chart">${barsHTML}</div>
      </div>
    `;
  }

  function buildWeakAreasCard(stats) {
    const weakDomains = [];

    Utils.DOMAINS.forEach(d => {
      const domainData = stats.domains[d.name];
      if (!domainData || domainData.total === 0) return;

      const totalReviews = domainData.know + domainData.unsure + domainData.dontknow;
      const dontKnowRate = totalReviews > 0 ? domainData.dontknow / totalReviews : 0;

      if (dontKnowRate > 0) {
        weakDomains.push({
          name: d.name,
          num: d.num,
          rate: dontKnowRate,
          dontknow: domainData.dontknow,
          total: totalReviews
        });
      }
    });

    weakDomains.sort((a, b) => b.rate - a.rate);

    if (weakDomains.length === 0) {
      return `
        <div class="dash-card">
          <h3>&#x26A0;&#xFE0F; Weak Areas</h3>
          <p style="color:var(--text-muted);font-size:0.9rem">No weak areas detected yet. Keep studying!</p>
        </div>
      `;
    }

    let weakHTML = '';
    weakDomains.slice(0, 5).forEach(w => {
      const pct = Math.round(w.rate * 100);
      weakHTML += `
        <div class="bar-row">
          <span class="bar-label">${w.num}. ${w.name}</span>
          <div class="bar-track"><div class="bar-fill bar-fill-red" style="width:${pct}%"></div></div>
          <span class="bar-value">${pct}%</span>
        </div>
      `;
    });

    return `
      <div class="dash-card">
        <h3>&#x26A0;&#xFE0F; Weak Areas</h3>
        <p style="color:var(--text-muted);font-size:0.75rem;margin-bottom:0.75rem">"Don't Know" rate by domain</p>
        <div class="bar-chart">${weakHTML}</div>
      </div>
    `;
  }

  function buildRecentSessionsCard(sessions) {
    const recent = sessions
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, 5);

    if (recent.length === 0) {
      return `
        <div class="dash-card">
          <h3>&#x1F4C5; Recent Sessions</h3>
          <p style="color:var(--text-muted);font-size:0.9rem">No sessions recorded yet.</p>
        </div>
      `;
    }

    let rowsHTML = '';
    recent.forEach(s => {
      const total = s.cardsStudied || 0;
      const know = s.results ? s.results.know : 0;
      const acc = total > 0 ? Math.round((know / total) * 100) : 0;
      const date = Utils.formatDate(s.startTime);

      rowsHTML += `
        <div class="summary-row">
          <span class="summary-label">${date}</span>
          <span class="summary-value">${total} cards — ${acc}%</span>
        </div>
      `;
    });

    return `
      <div class="dash-card">
        <h3>&#x1F4C5; Recent Sessions</h3>
        ${rowsHTML}
      </div>
    `;
  }

  return { init };

})();