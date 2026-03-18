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
    const existingIndex = {};
    existingCards.forEach(c => {
      existingIndex[Utils.normalizeTerm(c.term)] = c;
    });

    const newCards = [];
    const duplicates = [];
    const conflicts = [];

    parsedCards.forEach(card => {
      const normalized = Utils.normalizeTerm(card.term);
      const existing = existingIndex[normalized];

      if (!existing) {
        newCards.push(card);
      } else {
        const existingAnswer = existing.primaryAnswer.text.toLowerCase().trim();
        const newAnswer = card.primaryAnswer.text.toLowerCase().trim();

        const isDifferent = existingAnswer !== newAnswer && newAnswer.length > 0;

        if (isDifferent) {
          const alsoSeeEntry = {
            text: card.primaryAnswer.text,
            contributor: card.primaryAnswer.contributor,
            sourceDeck: card.primaryAnswer.sourceDeck || fileName,
            importedAt: Utils.nowISO()
          };

          const alreadyExists = existing.alsoSee.some(a =>
            a.text.toLowerCase().trim() === newAnswer
          );

          if (!alreadyExists) {
            duplicates.push({
              existingCard: existing,
              incomingCard: card,
              alsoSeeEntry,
              action: 'merge'
            });
          }
        } else {
          duplicates.push({
            existingCard: existing,
            incomingCard: card,
            alsoSeeEntry: null,
            action: 'skip'
          });
        }

        if (card.examTip && existing.examTip && card.examTip !== existing.examTip) {
          conflicts.push({
            cardTerm: card.term,
            existingCard: existing,
            incomingCard: card,
            field: 'examTip'
          });
        }
      }
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
      const name = c.primaryAnswer.contributor || 'Unknown';
      contributors[name] = (contributors[name] || 0) + 1;
    });

    duplicates.forEach(d => {
      if (d.incomingCard) {
        const name = d.incomingCard.primaryAnswer.contributor || 'Unknown';
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