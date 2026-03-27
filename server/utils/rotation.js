/**
 * Get the number of days per rotation cycle based on rotation type.
 */
function getCycleDays(rotationType, customDays) {
  switch (rotationType) {
    case 'daily': return 1;
    case 'weekly': return 7;
    case 'biweekly': return 14;
    case 'monthly': return 30;
    case 'custom': return customDays || 7;
    default: return 7;
  }
}

/**
 * Calculate the number of paused cycles that overlap with the period
 * from startDate to currentDate.
 */
function getPausedCycles(startDate, currentDate, pausedFrom, pausedTo, cycleDays) {
  if (!pausedFrom || !pausedTo) return 0;

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  const pFrom = new Date(pausedFrom);
  pFrom.setHours(0, 0, 0, 0);
  const pTo = new Date(pausedTo);
  pTo.setHours(0, 0, 0, 0);

  const effectiveStart = pFrom < start ? start : pFrom;
  const effectiveEnd = pTo > now ? now : pTo;

  if (effectiveEnd <= effectiveStart) return 0;

  const pausedDays = Math.floor((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24));
  return Math.floor(pausedDays / cycleDays);
}

/**
 * Check if the khatma is currently paused.
 */
function isPaused(pausedFrom, pausedTo, currentDate = new Date()) {
  if (!pausedFrom || !pausedTo) return false;

  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  const pFrom = new Date(pausedFrom);
  pFrom.setHours(0, 0, 0, 0);
  const pTo = new Date(pausedTo);
  pTo.setHours(0, 0, 0, 0);

  return now >= pFrom && now <= pTo;
}

/**
 * Calculate the current cycle number (0-indexed) from the start date,
 * excluding paused cycles.
 */
function getCycleNumber(startDate, currentDate = new Date(), pausedFrom = null, pausedTo = null, rotationType = 'weekly', customDays = null) {
  const cycleDays = getCycleDays(rotationType, customDays);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  const diffMs = now - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const totalCycles = Math.max(0, Math.floor(diffDays / cycleDays));

  const pausedCycles = getPausedCycles(startDate, currentDate, pausedFrom, pausedTo, cycleDays);

  return Math.max(0, totalCycles - pausedCycles);
}

/**
 * Calculate the current Juz' for a participant based on their initial slot.
 */
function getCurrentJuz(slotNumber, cycleNumber) {
  return ((slotNumber - 1 + cycleNumber) % 30) + 1;
}

/**
 * Determine which deceased person this cycle's Khatma is dedicated to.
 */
function getCycleDedication(deceasedList, cycleNumber, currentDate = new Date()) {
  if (!deceasedList || deceasedList.length === 0) return null;

  const sorted = [...deceasedList].sort(
    (a, b) => new Date(a.death_date) - new Date(b.death_date)
  );

  const now = new Date(currentDate);
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();

  let anniversaryPerson = null;
  for (const person of sorted) {
    const deathDate = new Date(person.death_date);
    if (deathDate.getMonth() === currentMonth && deathDate.getDate() === currentDay) {
      anniversaryPerson = person;
      break;
    }
    const dayDiff = Math.abs(
      (currentMonth * 31 + currentDay) - (deathDate.getMonth() * 31 + deathDate.getDate())
    );
    if (dayDiff <= 3) {
      anniversaryPerson = person;
    }
  }

  const dedicatedIndex = cycleNumber % sorted.length;
  const dedicated = sorted[dedicatedIndex];

  return {
    dedicated,
    isAnniversary: anniversaryPerson ? anniversaryPerson._id?.toString() === dedicated._id?.toString() : false,
    anniversaryPerson
  };
}

/**
 * Get Arabic label for rotation type.
 */
function getRotationLabel(rotationType, customDays) {
  switch (rotationType) {
    case 'daily': return 'يومياً';
    case 'weekly': return 'أسبوعياً';
    case 'biweekly': return 'كل أسبوعين';
    case 'monthly': return 'شهرياً';
    case 'custom': return `كل ${customDays} يوم`;
    default: return 'أسبوعياً';
  }
}

module.exports = { getCycleNumber, getCurrentJuz, getCycleDedication, isPaused, getRotationLabel, getCycleDays };
