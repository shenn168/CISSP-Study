/* ============================================================
   scenario.js — Scenario-Based Card Mode (Phase 3)
   ============================================================ */

const ScenarioMode = (() => {

  let scenarioQueue = [];
  let scenarioIndex = 0;
  let scenarioFlipped = false;
  let scenarioSession = null;

  async function init() {
    const container = document.getElementById('scenarioContent');
    const cards = await DB.getAllCards();
    const scenarios = cards.filter(c => c.type === 'scenario');

    if (scenarios.length === 0) {
      container.innerHTML = `
        <div class="no-cards">
          <span class="no-cards-icon">&#x1F3AD;</span>
          <p>No scenario cards loaded yet. Import a deck with scenario-type cards.</p>
          <button class="btn btn-primary" data-view="import">Import Deck</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="study-toolbar">
        <div class="study-filters">
          <select id="scenarioDomainFilter" class="select-input">
            <option value="all">All Domains</option>
          </select>
          <button class="btn btn-primary" id="startScenarioSession">Start Scenarios</button>
        </div>
      </div>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1rem">${scenarios.length} scenario card(s) available. Think like a manager!</p>

      <div class="hidden" id="scenarioSessionArea">
        <div class="study-progress">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" id="scenarioProgressBar"></div>
          </div>
          <span class="progress-text" id="scenarioProgressText">0 / 0</span>
        </div>

        <div class="scenario-card-container" id="scenarioCardArea">
          <div class="flip-card-container" id="scenarioFlipContainer">
            <div class="flip-card" id="scenarioFlipCard">
              <div class="flip-card-front">
                <div class="card-domain-badge" id="scnDomainBadge"></div>
                <div class="card-type-badge" data-type="scenario">&#x1F9D0; Think Like a Manager</div>
                <h3 class="card-term" id="scnTerm" style="font-size:1.2rem"></h3>
                <div class="card-scenario-text" id="scnScenarioText" style="display:block"></div>
                <p class="card-hint">Click or press Space to reveal the answer</p>
              </div>
              <div class="flip-card-back">
                <div class="card-domain-badge" id="scnDomainBadgeBack"></div>
                <div class="card-answer-section">
                  <h4>Recommended Approach</h4>
                  <p class="card-answer" id="scnAnswer"></p>
                </div>
                <div class="card-examtip-section hidden" id="scnExamTipSection">
                  <h4>&#x1F4A1; Exam Tip</h4>
                  <p class="card-examtip" id="scnExamTip"></p>
                </div>
                <div class="card-related-section hidden" id="scnRelatedSection">
                  <h4>Related Cards</h4>
                  <div class="card-related" id="scnRelated"></div>
                </div>
                <div class="card-attribution" id="scnAttribution"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="assessment-buttons" id="scenarioAssessButtons">
          <button class="btn assess-btn assess-know" data-quality="know">
            <span class="assess-icon">&#x2705;</span> Know It
            <span class="assess-key">1</span>
          </button>
          <button class="btn assess-btn assess-unsure" data-quality="unsure">
            <span class="assess-icon">&#x1F914;</span> Unsure
            <span class="assess-key">2</span>
          </button>
          <button class="btn assess-btn assess-dontknow" data-quality="dontknow">
            <span class="assess-icon">&#x274C;</span> Don't Know
            <span class="assess-key">3</span>
          </button>
        </div>

        <div class="session-controls">
          <button class="btn btn-ghost" id="endScenarioSession">End Session</button>
        </div>
      </div>

      <div class="session-complete hidden" id="scenarioComplete">
        <span class="complete-icon">&#x1F389;</span>
        <h3>Scenario Session Complete!</h3>
        <div class="session-summary" id="scenarioSummary"></div>
        <button class="btn btn-primary" id="newScenarioSession" style="margin-top:1rem">New Session</button>
      </div>
    `;

    // Populate domain filter
    const domainSelect = document.getElementById('scenarioDomainFilter');
    Utils.DOMAINS.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = `${d.num}. ${d.name}`;
      domainSelect.appendChild(opt);
    });

    // Event listeners
    document.getElementById('startScenarioSession').addEventListener('click', startSession);
    document.getElementById('scenarioFlipContainer').addEventListener('click', toggleFlip);
    document.getElementById('endScenarioSession').addEventListener('click', endSession);
    document.getElementById('newScenarioSession').addEventListener('click', () => {
      document.getElementById('scenarioComplete').classList.add('hidden');
      document.getElementById('scenarioSessionArea').classList.add('hidden');
      document.querySelector('#scenarioContent .study-toolbar').style.display = '';
    });

    document.querySelectorAll('#scenarioAssessButtons .assess-btn').forEach(btn => {
      btn.addEventListener('click', () => assessCard(btn.dataset.quality));
    });
  }

  async function startSession() {
    const allCards = await DB.getAllCards();
    const domainFilter = document.getElementById('scenarioDomainFilter').value;

    let scenarios = allCards.filter(c => c.type === 'scenario');
    if (domainFilter !== 'all') {
      scenarios = scenarios.filter(c => c.domain === domainFilter);
    }

    if (scenarios.length === 0) {
      Utils.toast('No scenario cards match the filter.', 'info');
      return;
    }

    scenarioQueue = Utils.shuffle(scenarios);
    scenarioIndex = 0;
    scenarioFlipped = false;

    scenarioSession = {
      id: Utils.generateUUID(),
      date: Utils.todayStr(),
      startTime: Utils.nowISO(),
      endTime: null,
      totalCards: scenarioQueue.length,
      results: { know: 0, unsure: 0, dontknow: 0 },
      domainBreakdown: {},
      cardsStudied: 0
    };

    document.querySelector('#scenarioContent .study-toolbar').style.display = 'none';
    document.getElementById('scenarioComplete').classList.add('hidden');
    document.getElementById('scenarioSessionArea').classList.remove('hidden');

    updateProgress();
    showCard();
  }

  function showCard() {
    if (scenarioIndex >= scenarioQueue.length) {
      completeSession();
      return;
    }

    const card = scenarioQueue[scenarioIndex];
    scenarioFlipped = false;
    document.getElementById('scenarioFlipCard').classList.remove('flipped');

    document.getElementById('scnDomainBadge').textContent = card.domain;
    document.getElementById('scnDomainBadgeBack').textContent = card.domain;
    document.getElementById('scnTerm').textContent = card.term;
    document.getElementById('scnScenarioText').textContent = card.scenarioText || '';
    document.getElementById('scnAnswer').textContent = card.primaryAnswer.text;

    const tipSection = document.getElementById('scnExamTipSection');
    const tipEl = document.getElementById('scnExamTip');
    if (card.examTip) {
      tipSection.classList.remove('hidden');
      tipEl.textContent = card.examTip;
    } else {
      tipSection.classList.add('hidden');
    }

    const relSection = document.getElementById('scnRelatedSection');
    const relEl = document.getElementById('scnRelated');
    if (card.relatedCards && card.relatedCards.length > 0) {
      relSection.classList.remove('hidden');
      relEl.innerHTML = '';
      card.relatedCards.forEach(r => {
        const span = document.createElement('span');
        span.className = 'related-tag';
        span.textContent = r;
        relEl.appendChild(span);
      });
    } else {
      relSection.classList.add('hidden');
    }

    document.getElementById('scnAttribution').textContent =
      `Contributor: ${card.primaryAnswer.contributor} | Source: ${card.primaryAnswer.sourceDeck}`;

    // Dynamic height
    requestAnimationFrame(() => {
      const front = document.querySelector('#scenarioFlipCard .flip-card-front');
      const back = document.querySelector('#scenarioFlipCard .flip-card-back');
      const maxH = Math.max(front.scrollHeight, back.scrollHeight, 400);
      document.getElementById('scenarioFlipCard').style.minHeight = maxH + 'px';
      front.style.minHeight = maxH + 'px';
      back.style.minHeight = maxH + 'px';
    });
  }

  function toggleFlip() {
    scenarioFlipped = !scenarioFlipped;
    const card = document.getElementById('scenarioFlipCard');
    if (scenarioFlipped) card.classList.add('flipped');
    else card.classList.remove('flipped');
  }

  async function assessCard(quality) {
    if (scenarioIndex >= scenarioQueue.length) return;
    if (!scenarioFlipped) { toggleFlip(); return; }

    const card = scenarioQueue[scenarioIndex];
    const updated = SM2.reviewCard(card, quality);
    await DB.saveCard(updated);
    scenarioQueue[scenarioIndex] = updated;

    scenarioSession.results[quality]++;
    scenarioSession.cardsStudied++;

    if (!scenarioSession.domainBreakdown[card.domain]) {
      scenarioSession.domainBreakdown[card.domain] = { know: 0, unsure: 0, dontknow: 0 };
    }
    scenarioSession.domainBreakdown[card.domain][quality]++;

    scenarioIndex++;
    updateProgress();
    showCard();
  }

  function updateProgress() {
    const pct = scenarioQueue.length > 0 ? (scenarioIndex / scenarioQueue.length) * 100 : 0;
    document.getElementById('scenarioProgressBar').style.width = pct + '%';
    document.getElementById('scenarioProgressText').textContent = `${scenarioIndex} / ${scenarioQueue.length}`;
  }

  async function completeSession() {
    scenarioSession.endTime = Utils.nowISO();
    await DB.saveSession(scenarioSession);

    const total = scenarioSession.cardsStudied;
    const know = scenarioSession.results.know;
    const accuracy = total > 0 ? Math.round((know / total) * 100) : 0;

    document.getElementById('scenarioSummary').innerHTML = `
      <div class="summary-row"><span class="summary-label">Scenarios Studied</span><span class="summary-value">${total}</span></div>
      <div class="summary-row"><span class="summary-label">Know It</span><span class="summary-value" style="color:var(--accent-green)">${know}</span></div>
      <div class="summary-row"><span class="summary-label">Unsure</span><span class="summary-value" style="color:var(--accent-yellow)">${scenarioSession.results.unsure}</span></div>
      <div class="summary-row"><span class="summary-label">Don't Know</span><span class="summary-value" style="color:var(--accent-red)">${scenarioSession.results.dontknow}</span></div>
      <div class="summary-row"><span class="summary-label">Accuracy</span><span class="summary-value">${accuracy}%</span></div>
    `;

    document.getElementById('scenarioSessionArea').classList.add('hidden');
    document.getElementById('scenarioComplete').classList.remove('hidden');
    Utils.toast(`Scenario session complete! ${accuracy}% accuracy.`, 'success');
  }

  async function endSession() {
    if (scenarioSession && scenarioSession.cardsStudied > 0) {
      await completeSession();
    } else {
      document.getElementById('scenarioSessionArea').classList.add('hidden');
      document.querySelector('#scenarioContent .study-toolbar').style.display = '';
    }
  }

  return { init };

})();