import { useState, useRef } from 'react';
import { api } from '../api/client';
import { ar } from '../utils/arabicNumbers';

function QuickJuzPicker({ khatmaId, participants, isDone, onJoined, onRefresh }) {
  const [juz, setJuz] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const byJuz = new Map(participants.map(p => [p.slot_number, p]));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('الرجاء كتابة اسمك');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await api.joinQuickKhatma(khatmaId, { name: name.trim(), slotNumber: juz });
      await onJoined(res.participant._id, res.token);
    } catch (err) {
      if (err.status === 409) {
        setError('هذا الجزء أخذه شخص آخر، اختر جزءًا آخر');
        setJuz(null);
        try { await onRefresh(); } catch { /* keep the message above */ }
      } else {
        setError(err.message);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (juz) {
    return (
      <form className="card" onSubmit={submit}>
        <p className="big-question">الجزء {ar(juz)}</p>
        <label className="big-label" htmlFor="quick-name">اكتب اسمك</label>
        <input
          id="quick-name"
          className="big-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>
          {busy ? 'جاري التسجيل…' : 'تأكيد'}
        </button>
        <button type="button" className="btn btn-big btn-secondary" onClick={() => { setJuz(null); setError(''); }}>
          رجوع
        </button>
      </form>
    );
  }

  return (
    <section>
      <h3 className="section-title">اختر الجزء الذي ستقرؤه</h3>
      {error && <div className="error-msg">{error}</div>}
      <div className="big-list">
        {Array.from({ length: 30 }, (_, i) => i + 1).map(n => {
          const p = byJuz.get(n);
          return p ? (
            <div key={n} className="big-row taken">
              <span className="big-row-main">الجزء {ar(n)} — {p.name}</span>
              <span className="status">{isDone(p._id) ? '✅ أنهى' : '⏳ لم ينته بعد'}</span>
            </div>
          ) : (
            <div key={n} className="big-row">
              <span className="big-row-main">الجزء {ar(n)} — متاح</span>
              <button
                className="btn btn-primary row-action"
                onClick={() => { setJuz(n); setName(''); setError(''); }}
              >
                اختر هذا الجزء
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default QuickJuzPicker;
