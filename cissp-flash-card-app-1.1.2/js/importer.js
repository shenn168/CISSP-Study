/* ============================================================
   importer.js — Import engine with duplicate detection & merge
   ============================================================ */

const Importer = (() => {

  let pendingImport = null;

  async function processFile(content, fileName, mergeMode = true) {
    const { cards: parsedCards, errors } = Parsers.parse(content, fileName);

    if (parsedCards.length === 0 && errors.length === 0) {
      errors.push({ line: 0, message: 'No cards found in the file.' });
    }

    if (!mergeMode) {
      pendingImport = {
        newCards: parsedCards,
        duplicates: [],
        conflicts: [],
        errors,
        deckName: fileName,
        totalParsed: parsedCards.length
      };
      return pendingImport;
    }

    const existingCards = await DB.getAllCards();

    // ──────────────────────────────────────────────
    // Build TWO lookup tables:
    // 1. By composite ID — detects same file re-import
    // 2. By normalized term+domain — detects true
    //    content duplicates across different files
    // ──────────────────────────────────────────────
    const existingById = {};
    const existingByContent = {};

    existingCards.forEach(c => {
      existingById[c.id] = c;

      var contentKey = _contentKey(c);
      // Only store the first card for each content key
      // to avoid self-collisions from prior bad imports
      if (!existingByContent[contentKey]) {
        existingByContent[contentKey] = c;
      }
    });

    const newCards = [];
    const duplicates = [];
    const conflicts = [];

    parsedCards.forEach(card => {
      // ── Check 1: Exact ID match (same file re-imported) ──
      var existingById_match = existingById[card.id];
      if (existingById_match) {
        var existingAnswer = (existingById_match.primaryAnswer && existingById_match.primaryAnswer.text)
          ? existingById_match.primaryAnswer.text.toLowerCase().trim()
          : '';
        var newAnswer = (card.primaryAnswer && card.primaryAnswer.text)
          ? card.primaryAnswer.text.toLowerCase().trim()
          : '';

        var isDifferent = existingAnswer !== newAnswer && newAnswer.length > 0;

        if (isDifferent) {
          // Same file re-imported but answer changed — offer merge
          var alsoSeeEntry = {
            text: card.primaryAnswer.text,
            contributor: card.primaryAnswer.contributor,
            sourceDeck: card.primaryAnswer.sourceDeck || fileName,
            importedAt: Utils.nowISO()
          };

          var alreadyHas = (existingById_match.alsoSee || []).some(function (a) {
            return a.text.toLowerCase().trim() === newAnswer;
          });

          if (!alreadyHas) {
            duplicates.push({
              existingCard: existingById_match,
              incomingCard: card,
              alsoSeeEntry: alsoSeeEntry,
              reason: 'same-id-updated',
              action: 'merge'
            });
          } else {
            duplicates.push({
              existingCard: existingById_match,
              incomingCard: card,
              alsoSeeEntry: null,
              reason: 'same-id-exact',
              action: 'skip'
            });
          }
        } else {
          // Exact same content — skip
          duplicates.push({
            existingCard: existingById_match,
            incomingCard: card,
            alsoSeeEntry: null,
            reason: 'same-id-exact',
            action: 'skip'
          });
        }

        // Check for examTip conflicts on re-import
        if (card.examTip && existingById_match.examTip && card.examTip !== existingById_match.examTip) {
          conflicts.push({
            cardTerm: card.term,
            existingCard: existingById_match,
            incomingCard: card,
            field: 'examTip'
          });
        }

        return; // processed — next card
      }

      // ── Check 2: Content-based duplicate (different file, same term+domain) ──
      var contentKey = _contentKey(card);
      var existingContent_match = existingByContent[contentKey];

      if (existingContent_match) {
        var existAns = (existingContent_match.primaryAnswer && existingContent_match.primaryAnswer.text)
          ? existingContent_match.primaryAnswer.text.toLowerCase().trim()
          : '';
        var incAns = (card.primaryAnswer && card.primaryAnswer.text)
          ? card.primaryAnswer.text.toLowerCase().trim()
          : '';

        var answerDiffers = existAns !== incAns && incAns.length > 0;

        if (answerDiffers) {
          var contentAlsoSee = {
            text: card.primaryAnswer.text,
            contributor: card.primaryAnswer.contributor,
            sourceDeck: card.primaryAnswer.sourceDeck || fileName,
            importedAt: Utils.nowISO()
          };

          var contentAlreadyHas = (existingContent_match.alsoSee || []).some(function (a) {
            return a.text.toLowerCase().trim() === incAns;
          });

          if (!contentAlreadyHas) {
            duplicates.push({
              existingCard: existingContent_match,
              incomingCard: card,
              alsoSeeEntry: contentAlsoSee,
              reason: 'content-match-different-answer',
              action: 'merge'
            });
          } else {
            duplicates.push({
              existingCard: existingContent_match,
              incomingCard: card,
              alsoSeeEntry: null,
              reason: 'content-match-exact',
              action: 'skip'
            });
          }
        } else {
          duplicates.push({
            existingCard: existingContent_match,
            incomingCard: card,
            alsoSeeEntry: null,
            reason: 'content-match-exact',
            action: 'skip'
          });
        }

        // Check for examTip conflicts on content match
        if (card.examTip && existingContent_match.examTip && card.examTip !== existingContent_match.examTip) {
          conflicts.push({
            cardTerm: card.term,
            existingCard: existingContent_match,
            incomingCard: card,
            field: 'examTip'
          });
        }

        return; // processed — next card
      }

      // ── No match: genuinely new card ──
      newCards.push(card);
    });

    pendingImport = {
      newCards,
      duplicates,
      conflicts,
      errors,
      deckName: fileName,
      totalParsed: parsedCards.length
    };

    return pendingImport;
  }

  /**
   * Build a content key from normalized term + domain.
   * This catches true duplicates across files that have
   * different IDs but identical content.
   */
  function _contentKey(card) {
    var term = Utils.normalizeTerm(card.term || '');
    var domain = (card.domain || '').trim().toLowerCase();
    return term + '|||' + domain;
  }

  async function confirmImport() {
    if (!pendingImport) return { imported: 0, merged: 0, skipped: 0 };

    const { newCards, duplicates, deckName } = pendingImport;

    let imported = 0;
    let merged = 0;
    let skipped = 0;

    if (newCards.length > 0) {
      await DB.saveCards(newCards);
      imported = newCards.length;
    }

    for (const dup of duplicates) {
      if (dup.action === 'merge' && dup.alsoSeeEntry) {
        const existing = dup.existingCard;

        if (!Array.isArray(existing.alsoSee)) {
          existing.alsoSee = [];
        }
        existing.alsoSee.push(dup.alsoSeeEntry);

        if (dup.incomingCard.tags) {
          const existingTags = new Set(existing.tags || []);
          dup.incomingCard.tags.forEach(t => existingTags.add(t));
          existing.tags = [...existingTags];
        }

        if (dup.incomingCard.relatedCards) {
          const existingRelated = new Set(existing.relatedCards || []);
          dup.incomingCard.relatedCards.forEach(r => existingRelated.add(r));
          existing.relatedCards = [...existingRelated];
        }

        if (pendingImport.conflicts.some(c => c.cardTerm === existing.term)) {
          existing.flagged = true;
        }

        await DB.saveCard(existing);
        merged++;
      } else {
        skipped++;
      }
    }

    const deckRecord = {
      id: Utils.generateUUID(),
      name: deckName,
      importedAt: Utils.nowISO(),
      cardCount: imported + merged,
      newCards: imported,
      mergedCards: merged,
      skippedCards: skipped,
      contributor: extractContributor(newCards, duplicates)
    };

    await DB.saveDeck(deckRecord);

    const result = { imported, merged, skipped };
    pendingImport = null;
    return result;
  }

  function cancelImport() {
    pendingImport = null;
  }

  function getPending() {
    return pendingImport;
  }

  function updateDuplicateAction(index, action) {
    if (pendingImport && pendingImport.duplicates[index]) {
      pendingImport.duplicates[index].action = action;
    }
  }

  function extractContributor(newCards, duplicates) {
    const contributors = {};

    newCards.forEach(c => {
      var name = (c.primaryAnswer && c.primaryAnswer.contributor) ? c.primaryAnswer.contributor : 'Unknown';
      contributors[name] = (contributors[name] || 0) + 1;
    });

    duplicates.forEach(d => {
      if (d.incomingCard && d.incomingCard.primaryAnswer) {
        var name = d.incomingCard.primaryAnswer.contributor || 'Unknown';
        contributors[name] = (contributors[name] || 0) + 1;
      }
    });

    const sorted = Object.entries(contributors).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'Unknown';
  }

  return {
    processFile,
    confirmImport,
    cancelImport,
    getPending,
    updateDuplicateAction
  };

})();