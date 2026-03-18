/* ============================================================
   studymode.js — Classic Flip Card Study Mode
   ============================================================ */

const StudyMode = (() => {

  let currentQueue = [];
  let currentIndex = 0;
  let isFlipped = false;
  let sessionData = null;

  async function init() {
    const cards = await DB.getAllCards();

    const domainSelect = document.getElementById('studyDomainFilter');
    domainSelect.innerHTML = '<option value="all">All Domains</option>';
    Utils.DOMAINS.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = `${d.num}. ${d.name}`;
      domainSelect.appendChild(opt);
    });

    const noCardsMsg = document.getElementById('noCardsMsg');
    const studyToolbar = document.querySelector('.study-toolbar');

    if (cards.length === 0) {
      noCardsMsg.classList.remove('hidden');
      studyToolbar.style.display = 'none';
    } else {
      noCardsMsg.classList.add('hidden');
      studyToolbar.style.display = '';
    }

    if (!StudyMode._initialized) {
      document.getElementById('startStudySession').addEventListener('click', startSession);
      document.getElementById('flipCardContainer').addEventListener('click', toggleFlip);
      document.getElementById('endSession').addEventListener('click', endSession);
      document.getElementById('newSession').addEventListener('click', () => {
        document.getElementById('sessionComplete').classList.add('hidden');
        document.getElementById('studySession').classList.add('hidden');
        document.querySelector('.study-toolbar').style.display = '';
        document.getElementById('noCardsMsg').classList.add('hidden');
      });

      document.querySelectorAll('.assess-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const quality = btn.dataset.quality;
          assessCard(quality);
        });
      });

      document.addEventListener('keydown', handleKeyboard);

      StudyMode._initialized = true;
    }
  }

  async function startSession() {
    const allCards = await DB.getAllCards();
    if (allCards.length === 0) {
      Utils.toast('No cards to study. Import a deck first!', 'error');
      return;
    }

    const domainFilter = document.getElementById('studyDomainFilter').value;
    const typeFilter = document.getElementById('studyTypeFilter').value;
    const queueFilter = document.getElementById('studyQueueFilter').value;

    let filtered = allCards;

    if (domainFilter !== 'all') {
      filtered = filtered.filter(c => c.domain === domainFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.type === typeFilter);
    }

    switch (queueFilter) {
      case 'due':
        filtered = filtered.filter(c => Utils.isDueToday(c));
        break;
      case 'new':
        filtered = filtered.filter(c => Utils.getMasteryTier(c) === 'new');
        break;
      case 'flagged':
        filtered = filtered.filter(c => c.flagged);
        break;
      case 'dontknow':
        filtered = filtered.filter(c => c.selfAssessment === 'dontknow');
        break;
    }

    if (filtered.length === 0) {
      Utils.toast('No cards match the current filters.', 'info');
      return;
    }

    currentQueue = Utils.shuffle(filtered);
    currentIndex = 0;
    isFlipped = false;

    sessionData = {
      id: Utils.generateUUID(),
      date: Utils.todayStr(),
      startTime: Utils.nowISO(),
      endTime: null,
      totalCards: currentQueue.length,
      results: { know: 0, unsure: 0, dontknow: 0 },
      domainBreakdown: {},
      cardsStudied: 0
    };

    document.querySelector('.study-toolbar').style.display = 'none';
    document.getElementById('noCardsMsg').classList.add('hidden');
    document.getElementById('sessionComplete').classList.add('hidden');
    document.getElementById('studySession').classList.remove('hidden');

    updateProgress();
    showCard();
  }

  function showCard() {
    if (currentIndex >= currentQueue.length) {
      completeSession();
      return;
    }

    const card = currentQueue[currentIndex];
    isFlipped = false;

    const flipCard = document.getElementById('flipCard');
    flipCard.classList.remove('flipped');

    const frontEl = document.querySelector('.flip-card-front');
    const backEl = document.querySelector('.flip-card-back');

    document.getElementById('cardDomainBadge').textContent = card.domain;
    document.getElementById('cardTypeBadge').textContent = card.type;
    document.getElementById('cardTypeBadge').setAttribute('data-type', card.type);
    document.getElementById('cardTerm').textContent = card.term;

    const tagsEl = document.getElementById('cardTags');
    tagsEl.innerHTML = '';
    if (card.tags && card.tags.length > 0) {
      card.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'card-tag';
        span.textContent = tag;
        tagsEl.appendChild(span);
      });
    }

    const scenarioFrontEl = document.getElementById('cardScenarioText');
    if (card.type === 'scenario' && card.scenarioText) {
      scenarioFrontEl.textContent = card.scenarioText;
      scenarioFrontEl.classList.remove('hidden');
    } else {
      scenarioFrontEl.classList.add('hidden');
    }

    document.getElementById('cardDomainBadgeBack').textContent = card.domain;
    document.getElementById('cardAnswer').textContent = card.primaryAnswer.text;

    const alsoSeeSection = document.getElementById('cardAlsoSeeSection');
    const alsoSeeEl = document.getElementById('cardAlsoSee');
    if (card.alsoSee && card.alsoSee.length > 0) {
      alsoSeeSection.classList.remove('hidden');
      alsoSeeEl.innerHTML = '';
      card.alsoSee.forEach(item => {
        const div = document.createElement('div');
        div.className = 'alsosee-item';
        div.innerHTML = `
          <div>${Utils.escapeHTML(item.text)}</div>
          <div class="alsosee-contributor">— ${Utils.escapeHTML(item.contributor)} (${Utils.escapeHTML(item.sourceDeck)})</div>
        `;
        alsoSeeEl.appendChild(div);
      });
    } else {
      alsoSeeSection.classList.add('hidden');
    }

    const examTipSection = document.getElementById('cardExamTipSection');
    const examTipEl = document.getElementById('cardExamTip');
    if (card.examTip) {
      examTipSection.classList.remove('hidden');
      examTipEl.textContent = card.examTip;
    } else {
      examTipSection.classList.add('hidden');
    }

    const relatedSection = document.getElementById('cardRelatedSection');
    const relatedEl = document.getElementById('cardRelated');
    if (card.relatedCards && card.relatedCards.length > 0) {
      relatedSection.classList.remove('hidden');
      relatedEl.innerHTML = '';
      card.relatedCards.forEach(rel => {
        const span = document.createElement('span');
        span.className = 'related-tag';
        span.textContent = typeof rel === 'string' ? rel : rel;
        span.addEventListener('click', (e) => {
          e.stopPropagation();
          jumpToRelatedCard(rel);
        });
        relatedEl.appendChild(span);
      });
    } else {
      relatedSection.classList.add('hidden');
    }

    document.getElementById('cardAttribution').textContent =
      `Contributor: ${card.primaryAnswer.contributor} | Source: ${card.primaryAnswer.sourceDeck} | Imported: ${Utils.formatDate(card.primaryAnswer.importedAt)}`;

    requestAnimationFrame(() => {
      const container = document.getElementById('flipCardContainer');
      const frontHeight = frontEl.scrollHeight;
      const backHeight = backEl.scrollHeight;
      const maxHeight = Math.max(frontHeight, backHeight, 380);
      container.querySelector('.flip-card').style.minHeight = maxHeight + 'px';
      frontEl.style.minHeight = maxHeight + 'px';
      backEl.style.minHeight = maxHeight + 'px';
    });
  }

  function toggleFlip() {
    const flipCard = document.getElementById('flipCard');
    isFlipped = !isFlipped;

    if (isFlipped) {
      flipCard.classList.add('flipped');
    } else {
      flipCard.classList.remove('flipped');
    }
  }

  async function assessCard(quality) {
    if (currentIndex >= currentQueue.length) return;
    if (!isFlipped) {
      toggleFlip();
      return;
    }

    const card = currentQueue[currentIndex];

    const updatedCard = SM2.reviewCard(card, quality);
    await DB.saveCard(updatedCard);

    currentQueue[currentIndex] = updatedCard;

    sessionData.results[quality]++;
    sessionData.cardsStudied++;

    if (!sessionData.domainBreakdown[card.domain]) {
      sessionData.domainBreakdown[card.domain] = { know: 0, unsure: 0, dontknow: 0 };
    }
    sessionData.domainBreakdown[card.domain][quality]++;

    currentIndex++;
    updateProgress();
    showCard();
  }

  function updateProgress() {
    const total = currentQueue.length;
    const current = currentIndex;
    const pct = total > 0 ? (current / total) * 100 : 0;

    document.getElementById('studyProgressBar').style.width = pct + '%';
    document.getElementById('studyProgressText').textContent = `${current} / ${total}`;
  }

  async function completeSession() {
    sessionData.endTime = Utils.nowISO();

    await DB.saveSession(sessionData);

    await updateStreak();

    const summaryEl = document.getElementById('sessionSummary');
    const total = sessionData.cardsStudied;
    const know = sessionData.results.know;
    const unsure = sessionData.results.unsure;
    const dontknow = sessionData.results.dontknow;
    const accuracy = total > 0 ? Math.round((know / total) * 100) : 0;

    const startTime = new Date(sessionData.startTime);
    const endTime = new Date(sessionData.endTime);
    const durationMs = endTime - startTime;
    const durationMin = Math.ceil(durationMs / 60000);

    summaryEl.innerHTML = `
      <div class="summary-row"><span class="summary-label">Cards Studied</span><span class="summary-value">${total}</span></div>
      <div class="summary-row"><span class="summary-label">Know It</span><span class="summary-value" style="color:var(--accent-green)">${know}</span></div>
      <div class="summary-row"><span class="summary-label">Unsure</span><span class="summary-value" style="color:var(--accent-yellow)">${unsure}</span></div>
      <div class="summary-row"><span class="summary-label">Don't Know</span><span class="summary-value" style="color:var(--accent-red)">${dontknow}</span></div>
      <div class="summary-row"><span class="summary-label">Accuracy</span><span class="summary-value">${accuracy}%</span></div>
      <div class="summary-row"><span class="summary-label">Duration</span><span class="summary-value">${durationMin} min</span></div>
    `;

    const domains = Object.entries(sessionData.domainBreakdown);
    if (domains.length > 0) {
      let domainHTML = '<div style="margin-top:1rem;border-top:1px solid var(--border-color);padding-top:0.75rem"><h4>Domain Breakdown</h4>';
      domains.forEach(([domain, results]) => {
        const domainTotal = results.know + results.unsure + results.dontknow;
        const domainAcc = domainTotal > 0 ? Math.round((results.know / domainTotal) * 100) : 0;
        domainHTML += `<div class="summary-row"><span class="summary-label" style="font-size:0.8rem">${Utils.escapeHTML(domain)}</span><span class="summary-value">${domainAcc}% (${domainTotal})</span></div>`;
      });
      domainHTML += '</div>';
      summaryEl.innerHTML += domainHTML;
    }

    document.getElementById('studySession').classList.add('hidden');
    document.getElementById('sessionComplete').classList.remove('hidden');

    Utils.toast(`Session complete! ${accuracy}% accuracy across ${total} cards.`, 'success');
  }

  async function updateStreak() {
    const today = Utils.todayStr();
    let streakData = await DB.getSetting('streak');

    if (!streakData) {
      streakData = { current: 1, longest: 1, lastDate: today };
    } else {
      const lastDate = new Date(streakData.lastDate);
      const todayDate = new Date(today);
      const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        // Same day — no change
      } else if (diffDays === 1) {
        streakData.current += 1;
      } else {
        streakData.current = 1;
      }

      streakData.lastDate = today;
      if (streakData.current > streakData.longest) {
        streakData.longest = streakData.current;
      }
    }

    await DB.setSetting('streak', streakData);
  }

  async function endSession() {
    if (sessionData && sessionData.cardsStudied > 0) {
      await completeSession();
    } else {
      document.getElementById('studySession').classList.add('hidden');
      document.querySelector('.study-toolbar').style.display = '';
      Utils.toast('Session ended.', 'info');
    }
  }

  async function jumpToRelatedCard(termStr) {
    const termIndex = await DB.buildTermIndex();
    const cardId = await DB.resolveRelatedCard(termStr, termIndex);

    if (cardId) {
      const card = await DB.getCardById(cardId);
      if (card) {
        const existsInQueue = currentQueue.some(c => c.id === cardId);
        if (!existsInQueue) {
          currentQueue.splice(currentIndex + 1, 0, card);
          updateProgress();
        }
        Utils.toast(`Related card "${card.term}" added to queue.`, 'info');
      }
    } else {
      Utils.toast(`Card "${termStr}" not found in your deck.`, 'info');
    }
  }

  function handleKeyboard(e) {
    const sessionEl = document.getElementById('studySession');
    if (sessionEl.classList.contains('hidden')) return;
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;

    switch (e.key) {
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        toggleFlip();
        break;
      case '1':
        assessCard('know');
        break;
      case '2':
        assessCard('unsure');
        break;
      case '3':
        assessCard('dontknow');
        break;
      case 'ArrowRight':
        if (isFlipped) {
          assessCard('unsure');
        } else {
          toggleFlip();
        }
        break;
    }
  }

  return {
    init,
    startSession,
    _initialized: false
  };

})();