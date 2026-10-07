import { useState, useRef } from 'react';
import { api } from '../api/client';
import { ar } from '../utils/arabicNumbers';
import { formatDate } from '../utils/hijriDate';
import ConfirmDialog from './ConfirmDialog';

function formatChangeDay(dateStr, useHijri) {
  const date = new Date(`${dateStr}T00:00:00`);
  const weekday = date.toLocaleDateString('ar-EG', { weekday: 'long' });
  return `${weekday} ${formatDate(date, useHijri)}`;
}

function MyJuzCard({ khatmaId, participant, juz, cycleNumber, done, nextChangeDate, useHijri, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [error, setError] = useState('');
  // A ref, not state: a second tap in the same tick must see "busy" immediately
  const busyRef = useRef(false);
  const firstName = participant.name.trim().split(/\s+/)[0];

  const run = async (action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const body = { participantId: participant._id, cycleNumber };
  const finish = () => run(() => api.markComplete(khatmaId, body));
  const undo = () => {
    setConfirmUndo(false);
    run(() => api.undoComplete(khatmaId, body));
  };

  return (
    <section>
      <p className="greeting">السلام عليكم يا {firstName} 🌷</p>

      <div className="juz-hero">
        <div className="juz-hero-label">جزؤك الحالي</div>
        <div className="juz-hero-number">الجزء {ar(juz)}</div>
        {nextChangeDate && (
          <div className="juz-hero-next">يتغير الجزء يوم {formatChangeDay(nextChangeDate, useHijri)}</div>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {done ? (
        <div className="done-box" role="status">
          <div className="done-title">✅ جزاك الله خيرًا 🌷</div>
          <div>تم تسجيل أنك أنهيت الجزء {ar(juz)}.</div>
          <button className="link-button" onClick={() => setConfirmUndo(true)} disabled={busy}>
            تراجع
          </button>
        </div>
      ) : (
        <>
          <a
            className="btn btn-big btn-primary"
            href={`https://quran.com/ar/juz/${juz}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            📖 ابدأ قراءة الجزء
          </a>
          <button className="btn btn-big btn-finish" onClick={finish} disabled={busy}>
            {busy ? 'جاري التسجيل…' : '✅ أنهيت قراءة الجزء'}
          </button>
        </>
      )}

      {confirmUndo && (
        <ConfirmDialog
          message="هل تريد التراجع عن تسجيل القراءة؟"
          confirmLabel="نعم، تراجع"
          onConfirm={undo}
          onCancel={() => setConfirmUndo(false)}
        />
      )}
    </section>
  );
}

export default MyJuzCard;
