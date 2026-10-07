import { useState } from 'react';
import { ar } from '../utils/arabicNumbers';

// View-only: no buttons inside the list, so nobody can change someone else's status by mistake
function ParticipantsList({ participants, juzOf, isDone }) {
  const [open, setOpen] = useState(false);
  const rows = [...participants].sort((a, b) => juzOf(a) - juzOf(b));

  return (
    <section>
      <button className="btn btn-big btn-secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'إخفاء المشاركين ▲' : 'عرض المشاركين ▼'}
      </button>
      {open && (
        <ul className="status-list">
          {rows.map(p => (
            <li key={p._id}>
              <span>الجزء {ar(juzOf(p))} — {p.name}</span>
              <span className="status">{isDone(p._id) ? '✅ أنهى' : '⏳ لم ينته بعد'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ParticipantsList;
