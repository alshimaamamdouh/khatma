import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/client';
import { formatDate } from '../../utils/hijriDate';
import BackButton from '../../components/BackButton';

function PauseScreen() {
  const { khatma, khatmaId, reload } = useOutletContext();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const isPaused = !!(khatma.paused_from && khatma.paused_to && today <= khatma.paused_to);

  const run = async (action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      try { await reload(); } catch { /* keep the original error */ }
      busyRef.current = false;
      setBusy(false);
    }
  };

  const pause = (e) => {
    e.preventDefault();
    if (!from || !to) return setError('الرجاء اختيار اليومين');
    if (to < from) return setError('يوم النهاية يجب أن يكون بعد يوم البداية');
    run(() => api.updateKhatma(khatmaId, { pausedFrom: from, pausedTo: to }));
  };

  return (
    <div>
      <h3 className="section-title">إيقاف مؤقت</h3>
      {error && <div className="error-msg">{error}</div>}

      {isPaused ? (
        <div className="card center-text">
          <p className="big-text">
            ⏸️ الختمة متوقفة من {formatDate(khatma.paused_from, khatma.use_hijri)} إلى {formatDate(khatma.paused_to, khatma.use_hijri)}
          </p>
          <button className="btn btn-big btn-primary" onClick={() => run(() => api.updateKhatma(khatmaId, { pausedFrom: '', pausedTo: '' }))} disabled={busy}>
            استئناف الختمة
          </button>
        </div>
      ) : (
        <form className="card" onSubmit={pause}>
          <p className="hint">في أيام الإيقاف لا تتغير الأجزاء (مثلًا في السفر أو رمضان).</p>
          <label className="big-label" htmlFor="pause-from">من يوم</label>
          <input id="pause-from" className="big-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="big-label" htmlFor="pause-to">إلى يوم</label>
          <input id="pause-to" className="big-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="submit" className="btn btn-big btn-primary" disabled={busy}>إيقاف الختمة</button>
        </form>
      )}

      <BackButton to=".." />
    </div>
  );
}

export default PauseScreen;
