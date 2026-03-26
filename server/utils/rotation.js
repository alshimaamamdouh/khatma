/**
 * Calculate the current week number (0-indexed) from the start date.
 */
function getWeekNumber(startDate, currentDate = new Date()) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const now = new Date(currentDate);
  now.setHours(0, 0, 0, 0);
  const diffMs = now - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.floor(diffDays / 7));
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
    isAnniversary: anniversaryPerson ? anniversaryPerson.id === dedicated.id : false,
    anniversaryPerson
  };
}

module.exports = { getWeekNumber, getCurrentJuz, getWeekDedication };
