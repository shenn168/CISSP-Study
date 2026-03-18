/* ============================================================
   app.js — Main Application Controller
   ============================================================ */

(async function () {

  // ---- Initialize Database ----
  try {
    await DB.open();
  } catch (err) {
    console.error('Failed to open IndexedDB:', err);
    Utils.toast('Failed to initialize database. Some features may not work.', 'error');
  }

  // ---- Theme ----
  const savedTheme = await DB.getSetting('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  document.getElementById('themeToggle').addEventListener('click', async () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    await DB.setSetting('theme', next);
  });

  // ---- Navigation ----
  const navButtons = document.querySelectorAll('[data-view]');
  const views = document.querySelectorAll('.view');

  function navigateTo(viewName) {
    views.forEach(v => v.classList.remove('active'));
    navButtons.forEach(b => b.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.classList.add('active');
    }

    document.querySelectorAll(`.nav-btn[data-view="${viewName}"]`).forEach(b => b.classList.add('active'));

    // Initialize view-specific content
    switch (viewName) {
      case 'home': initHome(); break;
      case 'study': StudyMode.init(); break;
      case 'scenarios': ScenarioMode.init(); break;
      case 'dashboard': Dashboard.init(); break;
      case 'decks': DeckManager.init(); break;
      case 'import': initImportView(); break;
      case 'export': Exporter.init(); break;
      case 'settings': Settings.init(); break;
    }

    // Update hash without triggering hashchange
    history.replaceState(null, '', `#${viewName}`);
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.view);
    });
  });

  // ---- Home View ----
  async function initHome() {
    const cards = await DB.getAllCards();
    const streakData = await DB.getSetting('streak');

    const totalCards = cards.length;
    const dueToday = cards.filter(c => Utils.isDueToday(c)).length;
    const mastered = cards.filter(c => Utils.getMasteryTier(c) === 'mastered').length;
    const streak = streakData ? streakData.current : 0;

    document.getElementById('statTotalCards').textContent = totalCards;
    document.getElementById('statDueToday').textContent = dueToday;
    document.getElementById('statMastered').textContent = mastered;
    document.getElementById('statStreak').textContent = streak;

    const domainContainer = document.getElementById('homeDomains');
    domainContainer.innerHTML = '';

    Utils.DOMAINS.forEach(d => {
      const count = cards.filter(c => c.domain === d.name).length;
      const div = document.createElement('div');
      div.className = 'domain-card';
      div.innerHTML = `
        <span class="domain-num">${d.num}</span>
        <span class="domain-name">${d.name}</span>
        <span class="domain-count">${count}</span>
      `;
      domainContainer.appendChild(div);
    });
  }

  // ---- Import View ----
  function initImportView() {
    const dropzone = document.getElementById('importDropzone');
    const fileInput = document.getElementById('importFileInput');
    const mergePreview = document.getElementById('mergePreview');
    const importErrors = document.getElementById('importErrors');
    const importSuccess = document.getElementById('importSuccess');

    mergePreview.classList.add('hidden');
    importErrors.classList.add('hidden');
    importSuccess.classList.add('hidden');

    const newDropzone = dropzone.cloneNode(true);
    dropzone.parentNode.replaceChild(newDropzone, dropzone);

    const newFileInput = newDropzone.querySelector('#importFileInput') || document.getElementById('importFileInput');

    newDropzone.addEventListener('click', () => newFileInput.click());

    newFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    newDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      newDropzone.classList.add('dragover');
    });

    newDropzone.addEventListener('dragleave', () => {
      newDropzone.classList.remove('dragover');
    });

    newDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      newDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    document.getElementById('confirmImport').onclick = confirmImport;
    document.getElementById('cancelImport').onclick = cancelImport;
  }

  async function handleFile(file) {
    const mergePreview = document.getElementById('mergePreview');
    const importErrors = document.getElementById('importErrors');
    const importSuccess = document.getElementById('importSuccess');

    mergePreview.classList.add('hidden');
    importErrors.classList.add('hidden');
    importSuccess.classList.add('hidden');

    const validExtensions = ['json', 'csv', 'txt'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(ext)) {
      Utils.toast('Unsupported file format. Use .json, .csv, or .txt', 'error');
      return;
    }

    const content = await file.text();
    const mergeMode = document.getElementById('mergeOnImport').checked;

    try {
      const result = await Importer.processFile(content, file.name, mergeMode);
      showImportPreview(result);
    } catch (err) {
      Utils.toast(`Error processing file: ${err.message}`, 'error');
      console.error(err);
    }
  }

  function showImportPreview(result) {
    const mergePreview = document.getElementById('mergePreview');
    const importErrors = document.getElementById('importErrors');

    if (result.errors.length > 0) {
      importErrors.classList.remove('hidden');
      const errorList = document.getElementById('importErrorList');
      errorList.innerHTML = '';
      result.errors.forEach(err => {
        const li = document.createElement('li');
        li.textContent = err.line > 0 ? `Line ${err.line}: ${err.message}` : err.message;
        errorList.appendChild(li);
      });
    }

    const mergeStats = document.getElementById('mergeStats');
    mergeStats.innerHTML = `
      <div class="merge-stat"><span class="merge-stat-num">${result.totalParsed}</span> parsed</div>
      <div class="merge-stat"><span class="merge-stat-num" style="color:var(--accent-green)">${result.newCards.length}</span> new</div>
      <div class="merge-stat"><span class="merge-stat-num" style="color:var(--accent-yellow)">${result.duplicates.filter(d => d.action === 'merge').length}</span> merge</div>
      <div class="merge-stat"><span class="merge-stat-num" style="color:var(--text-muted)">${result.duplicates.filter(d => d.action === 'skip').length}</span> skip</div>
      <div class="merge-stat"><span class="merge-stat-num" style="color:var(--accent-red)">${result.conflicts.length}</span> conflicts</div>
    `;

    const mergeList = document.getElementById('mergeList');
    mergeList.innerHTML = '';

    result.newCards.slice(0, 20).forEach(card => {
      const div = document.createElement('div');
      div.className = 'merge-item';
      div.innerHTML = `<span class="merge-item-new">+ ${Utils.escapeHTML(card.term)}</span><span style="font-size:0.75rem;color:var(--text-muted)">${card.domain}</span>`;
      mergeList.appendChild(div);
    });

    if (result.newCards.length > 20) {
      const more = document.createElement('div');
      more.className = 'merge-item';
      more.innerHTML = `<span style="color:var(--text-muted)">...and ${result.newCards.length - 20} more new cards</span>`;
      mergeList.appendChild(more);
    }

    result.duplicates.forEach(dup => {
      const div = document.createElement('div');
      div.className = 'merge-item';
      const label = dup.action === 'merge' ? 'merge-item-dup' : '';
      const actionText = dup.action === 'merge' ? '⇄ Merge' : '↷ Skip';
      div.innerHTML = `<span class="${label}">${actionText}: ${Utils.escapeHTML(dup.existingCard.term)}</span>`;
      mergeList.appendChild(div);
    });

    result.conflicts.forEach(conflict => {
      const div = document.createElement('div');
      div.className = 'merge-item';
      div.innerHTML = `<span class="merge-item-conflict">⚠ Conflict: ${Utils.escapeHTML(conflict.cardTerm)} (${conflict.field})</span>`;
      mergeList.appendChild(div);
    });

    if (result.newCards.length > 0 || result.duplicates.length > 0) {
      mergePreview.classList.remove('hidden');
    }
  }

  async function confirmImport() {
    try {
      const result = await Importer.confirmImport();
      const mergePreview = document.getElementById('mergePreview');
      const importSuccess = document.getElementById('importSuccess');

      mergePreview.classList.add('hidden');
      importSuccess.classList.remove('hidden');
      document.getElementById('importSuccessMsg').textContent =
        `Successfully imported ${result.imported} new cards and merged ${result.merged} duplicates. (${result.skipped} skipped)`;

      Utils.toast(`Import complete! ${result.imported} new, ${result.merged} merged.`, 'success');
    } catch (err) {
      Utils.toast(`Import failed: ${err.message}`, 'error');
      console.error(err);
    }
  }

  function cancelImport() {
    Importer.cancelImport();
    document.getElementById('mergePreview').classList.add('hidden');
    Utils.toast('Import cancelled.', 'info');
  }

  // ---- Hash-based Deep Linking ----
  function getInitialView() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    const validViews = ['home', 'study', 'scenarios', 'dashboard', 'decks', 'import', 'export', 'settings'];
    if (hash && validViews.includes(hash)) {
      return hash;
    }
    return 'home';
  }

  // ---- Initialize ----
  const initialView = getInitialView();
  navigateTo(initialView);

})();