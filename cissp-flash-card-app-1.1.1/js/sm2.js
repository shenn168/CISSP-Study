/* ============================================================
   sm2.js — SM-2 Spaced Repetition Algorithm
   ============================================================ */

const SM2 = (() => {

  function calculate(card, quality) {
    const qualityMap = {
      know: 5,
      unsure: 3,
      dontknow: 1
    };

    const q = qualityMap[quality] !== undefined ? qualityMap[quality] : 3;

    let { interval, easeFactor, repetitions } = card.sm2;

    if (!easeFactor || easeFactor < 1.3) easeFactor = 2.5;
    if (!interval || interval < 0) interval = 0;
    if (!repetitions || repetitions < 0) repetitions = 0;

    if (q >= 3) {
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    } else {
      repetitions = 0;
      interval = 1;
    }

    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

    if (easeFactor < 1.3) easeFactor = 1.3;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(today);
    next.setDate(next.getDate() + interval);
    const nextReviewDate = next.toISOString().split('T')[0];

    return {
      interval,
      easeFactor: Math.round(easeFactor * 100) / 100,
      repetitions,
      nextReviewDate
    };
  }

  function createReviewEvent(quality) {
    return {
      timestamp: Utils.nowISO(),
      quality,
      date: Utils.todayStr()
    };
  }

  function reviewCard(card, quality) {
    const newSM2 = calculate(card, quality);
    const event = createReviewEvent(quality);

    return {
      ...card,
      sm2: newSM2,
      selfAssessment: quality,
      reviewHistory: [...(card.reviewHistory || []), event]
    };
  }

  return {
    calculate,
    createReviewEvent,
    reviewCard
  };

})();