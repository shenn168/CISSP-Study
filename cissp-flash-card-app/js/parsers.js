/* ============================================================
   parsers.js — File format parsers (JSON, CSV, Plain-text)
   ============================================================ */

const Parsers = (() => {

  function parse(content, fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    const trimmed = content.trim();

    if (ext === 'json') return parseJSON(trimmed, fileName);
    if (ext === 'csv') return parseCSV(trimmed, fileName);
    if (ext === 'txt') return parsePlainText(trimmed, fileName);

    // Content sniffing
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) return parseJSON(trimmed, fileName);
    if (trimmed.indexOf('TERM:') !== -1 && trimmed.indexOf('ANSWER:') !== -1) return parsePlainText(trimmed, fileName);
    if (trimmed.indexOf(',') !== -1) {
      var firstLine = trimmed.split('\
')[0].toLowerCase();
      if (firstLine.indexOf('term') !== -1) return parseCSV(trimmed, fileName);
    }

    return {
      cards: [],
      errors: [{ line: 0, message: 'Unable to detect format for "' + fileName + '". Supported: .json, .csv, .txt' }]
    };
  }

  function parseJSON(content, fileName) {
    var cards = [];
    var errors = [];

    var parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      errors.push({ line: 0, message: 'JSON parse error: ' + e.message });
      return { cards: cards, errors: errors };
    }

    // Support both array and single object
    var items = Array.isArray(parsed) ? parsed : [parsed];

    if (items.length === 0) {
      errors.push({ line: 0, message: 'JSON array is empty. No cards found.' });
      return { cards: cards, errors: errors };
    }

    for (var index = 0; index < items.length; index++) {
      var item = items[index];
      try {
        // Validate minimum required field
        var term = item.term || item.TERM || item.Term || '';
        if (!term || term.trim().length === 0) {
          errors.push({ line: index + 1, message: 'Card ' + (index + 1) + ': Missing "term" field. Skipping.' });
          continue;
        }

        // Normalize the item to flat format for createCard
        var cardData = normalizeJSONItem(item, fileName);

        // Warn about unknown domain but do not skip
        if (item.domain) {
          var valid = Utils.validateDomain(item.domain);
          if (!valid) {
            errors.push({ line: index + 1, message: 'Card ' + (index + 1) + ': Unknown domain "' + item.domain + '". Defaulting to Domain 1.' });
          }
        }

        // Warn about invalid type but do not skip
        if (item.type) {
          var typeLower = item.type.toLowerCase();
          if (typeLower !== 'definition' && typeLower !== 'scenario') {
            errors.push({ line: index + 1, message: 'Card ' + (index + 1) + ': Invalid type "' + item.type + '". Defaulting to "definition".' });
          }
        }

        var card = Utils.createCard(cardData);
        cards.push(card);

      } catch (cardErr) {
        errors.push({ line: index + 1, message: 'Card ' + (index + 1) + ': Error processing — ' + cardErr.message });
      }
    }

    return { cards: cards, errors: errors };
  }

  /**
   * Normalize a JSON item to the flat format that createCard() expects.
   * Handles both flat import format and full internal schema format.
   */
  function normalizeJSONItem(item, fileName) {
    var data = {};

    // Term
    data.term = item.term || item.TERM || item.Term || '';

    // Domain
    data.domain = item.domain || item.DOMAIN || item.Domain || '';

    // Type
    data.type = item.type || item.TYPE || item.Type || 'definition';

    // Answer — handle multiple possible structures
    if (item.primaryAnswer && typeof item.primaryAnswer === 'object') {
      // Full schema format
      data.primaryAnswer = {
        text: item.primaryAnswer.text || '',
        contributor: item.primaryAnswer.contributor || 'Unknown',
        sourceDeck: item.primaryAnswer.sourceDeck || fileName || 'Unknown',
        importedAt: item.primaryAnswer.importedAt || Utils.nowISO()
      };
    } else {
      // Flat import format
      var answerText = item.answer || item.ANSWER || item.Answer || '';
      var contributor = item.contributor || item.CONTRIBUTOR || item.Contributor || 'Unknown';
      data.primaryAnswer = {
        text: answerText,
        contributor: contributor,
        sourceDeck: fileName || 'Unknown',
        importedAt: Utils.nowISO()
      };
      data.answer = answerText;
      data.contributor = contributor;
    }

    // Exam tip
    data.examTip = item.examTip || item.examtip || item.ExamTip || item.tip || item.TIP || item.Tip || '';

    // Scenario text
    data.scenarioText = item.scenarioText || item.scenariotext || item.ScenarioText || item.scenario || item.SCENARIO || '';

    // Related cards
    var relRaw = item.relatedCards || item.related || item.RELATED || item.RelatedCards || null;
    if (Array.isArray(relRaw)) {
      data.relatedCards = relRaw;
    } else if (typeof relRaw === 'string' && relRaw.length > 0) {
      data.relatedCards = relRaw.split(';').map(function (r) { return r.trim(); }).filter(function (r) { return r.length > 0; });
    } else {
      data.relatedCards = [];
    }

    // Tags
    var tagsRaw = item.tags || item.TAGS || item.Tags || null;
    if (Array.isArray(tagsRaw)) {
      data.tags = tagsRaw;
    } else if (typeof tagsRaw === 'string' && tagsRaw.length > 0) {
      data.tags = tagsRaw.split(';').map(function (t) { return t.trim(); }).filter(function (t) { return t.length > 0; });
    } else {
      data.tags = [];
    }

    // Also see
    if (Array.isArray(item.alsoSee)) {
      data.alsoSee = [];
      for (var a = 0; a < item.alsoSee.length; a++) {
        var entry = item.alsoSee[a];
        data.alsoSee.push({
          text: entry.text || '',
          contributor: entry.contributor || 'Unknown',
          sourceDeck: entry.sourceDeck || fileName || 'Unknown',
          importedAt: entry.importedAt || Utils.nowISO()
        });
      }
    } else {
      data.alsoSee = [];
    }

    // Flagged
    data.flagged = item.flagged === true || item.flagged === 'true';

    // SM2 (only present in full schema exports)
    if (item.sm2 && typeof item.sm2 === 'object') {
      data.sm2 = item.sm2;
    }

    // Review history (only present in full schema exports)
    if (Array.isArray(item.reviewHistory)) {
      data.reviewHistory = item.reviewHistory;
    }

    // Self assessment
    if (item.selfAssessment) {
      data.selfAssessment = item.selfAssessment;
    }

    // ID (preserve if re-importing exported cards)
    if (item.id) {
      data.id = item.id;
    }

    return data;
  }

  function parseCSV(content, fileName) {
    var cards = [];
    var errors = [];
    var lines = parseCSVLines(content);

    if (lines.length < 2) {
      errors.push({ line: 0, message: 'CSV must have a header row and at least one data row.' });
      return { cards: cards, errors: errors };
    }

    var headers = [];
    for (var h = 0; h < lines[0].length; h++) {
      headers.push(lines[0][h].trim().toLowerCase());
    }

    var colMap = {};
    var knownCols = ['term', 'domain', 'type', 'answer', 'examtip', 'tip', 'relatedcards', 'related', 'contributor', 'tags', 'scenariotext', 'scenario', 'flagged'];

    for (var hi = 0; hi < headers.length; hi++) {
      // Remove non-alpha characters for matching
      var clean = '';
      for (var ci = 0; ci < headers[hi].length; ci++) {
        var ch = headers[hi][ci];
        if (ch >= 'a' && ch <= 'z') {
          clean += ch;
        }
      }
      for (var ki = 0; ki < knownCols.length; ki++) {
        if (clean.indexOf(knownCols[ki]) !== -1) {
          colMap[knownCols[ki]] = hi;
          break;
        }
      }
    }

    if (colMap.term === undefined) {
      errors.push({ line: 1, message: 'CSV header must include a "term" column.' });
      return { cards: cards, errors: errors };
    }

    for (var i = 1; i < lines.length; i++) {
      var row = lines[i];
      if (row.length === 0) continue;
      if (row.length === 1 && row[0].trim() === '') continue;

      var term = (colMap.term !== undefined && colMap.term < row.length) ? row[colMap.term].trim() : '';

      if (!term) {
        errors.push({ line: i + 1, message: 'Missing term value. Skipping row.' });
        continue;
      }

      var getCSVVal = function (key) {
        var idx = colMap[key];
        if (idx !== undefined && idx < row.length) {
          return row[idx].trim();
        }
        return '';
      };

      var cardData = {
        term: term,
        domain: getCSVVal('domain'),
        type: getCSVVal('type'),
        answer: getCSVVal('answer'),
        examTip: getCSVVal('examtip') || getCSVVal('tip'),
        contributor: getCSVVal('contributor'),
        tags: getCSVVal('tags'),
        scenarioText: getCSVVal('scenariotext') || getCSVVal('scenario'),
        flagged: getCSVVal('flagged') === 'true'
      };

      var relatedStr = getCSVVal('relatedcards') || getCSVVal('related');

      cardData.primaryAnswer = {
        text: cardData.answer,
        contributor: cardData.contributor || 'Unknown',
        sourceDeck: fileName || 'Unknown',
        importedAt: Utils.nowISO()
      };

      if (relatedStr.length > 0) {
        cardData.relatedCards = relatedStr.split(';').map(function (r) { return r.trim(); }).filter(function (r) { return r.length > 0; });
      } else {
        cardData.relatedCards = [];
      }

      cards.push(Utils.createCard(cardData));
    }

    return { cards: cards, errors: errors };
  }

  function parsePlainText(content, fileName) {
    var cards = [];
    var errors = [];

    // Split by --- delimiter line
    // Instead of a complex regex, use a manual split
    var rawLines = content.split('\n');
    var blocks = [];
    var currentBlock = '';

    for (var li = 0; li < rawLines.length; li++) {
      var line = rawLines[li];
      var trimmedLine = line.trim();
      if (trimmedLine === '---') {
        if (currentBlock.trim().length > 0) {
          blocks.push(currentBlock);
        }
        currentBlock = '';
      } else {
        currentBlock += line + '\
';
      }
    }
    // Push last block
    if (currentBlock.trim().length > 0) {
      blocks.push(currentBlock);
    }

    for (var bi = 0; bi < blocks.length; bi++) {
      var block = blocks[bi].trim();
      if (!block) continue;

      var fields = {};
      var blockLines = block.split('\
');

      var currentKey = null;
      var currentValue = '';

      for (var bli = 0; bli < blockLines.length; bli++) {
        var bline = blockLines[bli];

        // Check if line starts with a known field label
        var fieldMatch = matchFieldLabel(bline);

        if (fieldMatch) {
          // Save previous field
          if (currentKey) {
            fields[currentKey] = currentValue.trim();
          }
          currentKey = fieldMatch.key;
          currentValue = fieldMatch.value;
        } else if (currentKey) {
          // Continuation line
          currentValue += '\
' + bline;
        }
      }

      // Save last field
      if (currentKey) {
        fields[currentKey] = currentValue.trim();
      }

      if (!fields.TERM) {
        errors.push({ line: bi + 1, message: 'Block ' + (bi + 1) + ': Missing TERM field.' });
        continue;
      }

      var cardData = {
        term: fields.TERM || '',
        domain: fields.DOMAIN || '',
        type: fields.TYPE || 'definition',
        answer: fields.ANSWER || '',
        examTip: fields.TIP || '',
        contributor: fields.CONTRIBUTOR || 'Unknown',
        tags: fields.TAGS || '',
        scenarioText: fields.SCENARIO || '',
        flagged: (fields.FLAGGED || '').toLowerCase() === 'true'
      };

      cardData.primaryAnswer = {
        text: cardData.answer,
        contributor: cardData.contributor,
        sourceDeck: fileName || 'Unknown',
        importedAt: Utils.nowISO()
      };

      var relStr = fields.RELATED || '';
      if (relStr.length > 0) {
        cardData.relatedCards = relStr.split(';').map(function (r) { return r.trim(); }).filter(function (r) { return r.length > 0; });
      } else {
        cardData.relatedCards = [];
      }

      cards.push(Utils.createCard(cardData));
    }

    return { cards: cards, errors: errors };
  }

  /**
   * Match a plain-text field label at the start of a line.
   * Returns { key, value } or null.
   */
  function matchFieldLabel(line) {
    var labels = ['TERM', 'DOMAIN', 'TYPE', 'ANSWER', 'TIP', 'RELATED', 'CONTRIBUTOR', 'TAGS', 'SCENARIO', 'FLAGGED'];

    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      var prefix = label + ':';
      var prefixLower = label.toLowerCase() + ':';
      var lineUpper = line.trimStart();

      // Check case-insensitive
      if (lineUpper.length >= prefix.length) {
        var lineStart = lineUpper.substring(0, prefix.length).toUpperCase();
        if (lineStart === prefix) {
          var rest = lineUpper.substring(prefix.length);
          // Remove leading whitespace from value
          var value = rest;
          if (value.length > 0 && value[0] === ' ') {
            value = value.substring(1);
          }
          return { key: label, value: value };
        }
      }
    }

    return null;
  }

  function parseCSVLines(text) {
    var rows = [];
    var currentRow = [];
    var currentField = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var next = i + 1 < text.length ? text[i + 1] : '';

      if (inQuotes) {
        if (ch === '"' && next === '"') {
          currentField += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          currentField += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          currentRow.push(currentField);
          currentField = '';
        } else if (ch === '\
') {
          currentRow.push(currentField);
          currentField = '';
          rows.push(currentRow);
          currentRow = [];
        } else if (ch === '\r') {
          currentRow.push(currentField);
          currentField = '';
          rows.push(currentRow);
          currentRow = [];
          if (next === '\
') {
            i++;
          }
        } else {
          currentField += ch;
        }
      }
    }

    // Last field and row
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    return rows;
  }

  return {
    parse: parse,
    parseJSON: parseJSON,
    parseCSV: parseCSV,
    parsePlainText: parsePlainText
  };

})();