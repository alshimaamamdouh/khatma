/**
 * Calculate the number of paused weeks that overlap with the period
 * from startDate to currentDate.
 */
function getPausedWeeks(startDate, currentDate, pausedFrom, pausedTo) {
  if (!pausedFrom || !pausedTo) return 0;

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  const pFrom = new Date(pausedFrom);
  pFrom.setHours(0, 0, 0, 0);
  const pTo = new Date(pausedTo);
  pTo.setHours(0, 0, 0, 0);

  // Clamp pause period to within start..now
  const effectiveStart = pFrom < start ? start : pFrom;
  const effectiveEnd = pTo > now ? now : pTo;

  if (effectiveEnd <= effectiveStart) return 0;

  const pausedDays = Math.floor((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24));
  return Math.floor(pausedDays / 7);
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
 * Calculate the current week number (0-indexed) from the start date,
 * excluding paused weeks.
 */
function getWeekNumber(startDate, currentDate = new Date(), pausedFrom = null, pausedTo = null) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  const diffMs = now - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.max(0, Math.floor(diffDays / 7));

  const pausedWeeks = getPausedWeeks(startDate, currentDate, pausedFrom, pausedTo);

  return Math.max(0, totalWeeks - pausedWeeks);
}

/**
 * Calculate the current Juz' for a participant based on their initial slot.
 * slotNumber: 1-30 (initial assignment)
 * weekNumber: 0-indexed week count
 * Returns: 1-30
 */
function getCurrentJuz(slotNumber, weekNumber) {
  return ((slotNumber - 1 + weekNumber) % 30) + 1;
}

/**
 * Determine which deceased person this week's Khatma is dedicated to.
 * Uses round-robin based on week number, with anniversary highlighting.
 */
function getWeekDedication(deceasedList, weekNumber, currentDate = new Date()) {
  if (!deceasedList || deceasedList.length === 0) return null;

  // Sort by death_date ascending
  const sorted = [...deceasedList].sort(
    (a, b) => new Date(a.death_date) - new Date(b.death_date)
  );

  // Check for anniversary this week (same month and day)
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
    // Check within the same week (±3 days)
    const dayDiff = Math.abs(
      (currentMonth * 31 + currentDay) - (deathDate.getMonth() * 31 + deathDate.getDate())
    );
    if (dayDiff <= 3) {
      anniversaryPerson = person;
    }
  }

  // Round-robin dedication
  const dedicatedIndex = weekNumber % sorted.length;
  const dedicated = sorted[dedicatedIndex];

  return {
    dedicated,
    isAnniversary: anniversaryPerson ? anniversaryPerson._id?.toString() === dedicated._id?.toString() : false,
    anniversaryPerson
  };
}

module.exports = { getWeekNumber, getCurrentJuz, getWeekDedication, isPaused };
