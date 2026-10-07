import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/client';
import { ar } from '../../utils/arabicNumbers';
import { useCycleStatus } from './useCycleStatus';
import ConfirmDialog from '../../components/ConfirmDialog';
import BackButton from '../../components/BackButton';

function FinishedScreen() {
  const { khatma, khatmaId } = useOutletContext();
  const { dash, completions, loading, error: loadError, reload } = useCycleStatus(khatmaId);
  const [toUndo, setToUndo] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const busyRef = useRef(false);

  if (loading) return <div className="loading">جاري التحميل...</div>;
  if (!dash || !completions) return <div className="error-msg">{loadError || 'تعذّر التحميل'}</div>;

  const isDone = (pid) => completions.completedIds.includes(pid);
  const juzOf = (p) => (khatma.is_quick ? p.slot_number : p.currentJuz);
  const rows = [...dash.participants].sort((a, b) => juzOf(a) - juzOf(b));

  const run = async (pid, action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(pid);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      try { await reload(); } catch { /* keep the original error */ }
      busyRef.current = false;
      setBusyId(null);
    }
  };

  const body = (p) => ({ participantId: p._id, cycleNumber: dash.cycleNumber });

  return (
    <div>
      <h3 className="section-title">تسجيل من أنهى القراءة</h3>
      <p className="hint">{ar(completions.completedCount)} من {ar(completions.totalParticipants)} أنهوا القراءة</p>
      {(error || loadError) && <div className="error-msg">{error || loadError}</div>}

      <div className="big-list">
        {rows.map(p => (
          <div key={p._id} className="big-row">
            <span className="big-row-main">الجزء {ar(juzOf(p))} — {p.name}</span>
            <span className="status">{isDone(p._id) ? '✅ أنهى' : '⏳ لم ينته بعد'}</span>
            <div className="row-actions">
              {isDone(p._id) ? (
                <button className="btn btn-secondary" onClick={() => setToUndo(p)} disabled={busyId !== null}>تراجع</button>
              ) : (
                <button className="btn btn-primary" onClick={() => run(p._id, () => api.markComplete(khatmaId, body(p)))} disabled={busyId !== null}>
                  {busyId === p._id ? 'جاري التسجيل…' : 'سجّل أنه أنهى'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <BackButton to=".." />

      {toUndo && (
        <ConfirmDialog
          message={`هل تريد التراجع عن تسجيل قراءة ${toUndo.name}؟`}
          confirmLabel="نعم، تراجع"
          onConfirm={() => { const p = toUndo; setToUndo(null); run(p._id, () => api.undoComplete(khatmaId, body(p))); }}
          onCancel={() => setToUndo(null)}
        />
      )}
    </div>
  );
}

export default FinishedScreen;
