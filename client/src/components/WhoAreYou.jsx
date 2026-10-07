import { useState, useRef } from 'react';
import { api } from '../api/client';

function WhoAreYou({ khatmaId, participants, onClaimed }) {
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);

  const confirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await api.claimParticipant(khatmaId, selected._id);
      onClaimed(selected._id, res.token);
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (participants.length === 0) {
    return (
      <div className="card center-text big-text">
        لم يُضِف منظم الختمة الأسماء بعد. حاول لاحقًا إن شاء الله.
      </div>
    );
  }

  if (selected) {
    return (
      <section className="card">
        <p className="big-question">هل أنت {selected.name}؟</p>
        {error && <div className="error-msg">{error}</div>}
        <button className="btn btn-big btn-primary" onClick={confirm} disabled={busy}>
          {busy ? 'جاري التحميل…' : 'نعم'}
        </button>
        <button className="btn btn-big btn-secondary" onClick={() => setSelected(null)} disabled={busy}>
          لا
        </button>
      </section>
    );
  }

  return (
    <section>
      <h3 className="section-title">مَن أنت؟ اضغط على اسمك</h3>
      <div className="big-list">
        {participants.map(p => (
          <button key={p._id} className="big-row-button" onClick={() => setSelected(p)}>
            {p.name}
          </button>
        ))}
      </div>
    </section>
  );
}

export default WhoAreYou;
