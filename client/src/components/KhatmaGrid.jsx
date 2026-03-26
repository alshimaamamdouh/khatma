import { getJuzName } from '../utils/juzNames';

function KhatmaGrid({ participants, highlightJuz }) {
  // Create a map from juz number to participant
  const juzMap = {};
  participants.forEach(p => {
    juzMap[p.currentJuz] = p;
  });

  return (
    <div className="juz-grid">
      {Array.from({ length: 30 }, (_, i) => i + 1).map(juzNum => {
        const participant = juzMap[juzNum];
        const isHighlighted = juzNum === highlightJuz;
        return (
          <div key={juzNum} className={`juz-card ${isHighlighted ? 'highlighted' : ''}`}>
            <div className="juz-number">{juzNum}</div>
            <div className="participant-name">
              {participant ? participant.name : 'شاغر'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default KhatmaGrid;
