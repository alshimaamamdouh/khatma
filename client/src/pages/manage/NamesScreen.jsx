import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/client';
import { ar } from '../../utils/arabicNumbers';
import ConfirmDialog from '../../components/ConfirmDialog';
import BackButton from '../../components/BackButton';

function NamesScreen() {
  const { khatma, khatmaId, participants, reload } = useOutletContext();
  const [newName, setNewName] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [editing, setEditing] = useState(null); // participant being renamed
  const [editName, setEditName] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const sorted = [...participants].sort((a, b) => a.slot_number - b.slot_number);
  const freeSlots = () => {
    const taken = new Set(participants.map(p => p.slot_number));
    return Array.from({ length: 30 }, (_, i) => i + 1).filter(n => !taken.has(n));
  };

  const run = async (action, successMessage) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      if (successMessage) setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      try { await reload(); } catch { /* keep the original error */ }
      busyRef.current = false;
      setBusy(false);
    }
  };

  const addOne = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) { setMessage(''); return setError('الرجاء كتابة الاسم'); }
    const slot = freeSlots()[0];
    if (!slot) { setMessage(''); return setError('اكتمل العدد: ٣٠ اسمًا'); }
    run(async () => {
      await api.addParticipant(khatmaId, { name, slotNumber: slot });
      setNewName('');
    }, `تمت إضافة ${name}`);
  };

  const addMany = (e) => {
    e.preventDefault();
    const names = bulkText.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) { setMessage(''); return setError('الرجاء كتابة اسم واحد على الأقل'); }
    const slots = freeSlots();
    if (names.length > slots.length) { setMessage(''); return setError(`يمكن إضافة ${ar(slots.length)} أسماء فقط`); }
    run(async () => {
      let added = 0;
      try {
        for (let i = 0; i < names.length; i++) {
          await api.addParticipant(khatmaId, { name: names[i], slotNumber: slots[i] });
          added++;
        }
      } catch (err) {
        if (added > 0) {
          setBulkText(names.slice(added).join('\n'));
          throw new Error(`تمت إضافة ${ar(added)} من ${ar(names.length)}. ${err.message}`);
        }
        throw err;
      }
      setBulkText('');
      setBulkOpen(false);
    }, `تمت إضافة ${ar(names.length)} أسماء`);
  };

  const saveEdit = (e) => {
    e.preventDefault();
    const name = editName.trim();
    if (!name) { setMessage(''); return setError('الرجاء كتابة الاسم'); }
    run(async () => {
      await api.updateParticipant(khatmaId, editing._id, { name });
      setEditing(null);
    }, 'تم حفظ الاسم');
  };

  const move = (index, direction) => {
    const target = sorted[index + direction];
    if (!target) return;
    run(() => api.swapParticipants(khatmaId, sorted[index]._id, target._id));
  };

  const confirmDelete = () => {
    const p = toDelete;
    setToDelete(null);
    run(() => api.deleteParticipant(khatmaId, p._id), `تم حذف ${p.name}`);
  };

  if (editing) {
    return (
      <form className="card" onSubmit={saveEdit}>
        <label className="big-label" htmlFor="edit-name">الاسم الجديد</label>
        <input id="edit-name" className="big-input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>حفظ</button>
        <button type="button" className="btn btn-big btn-secondary" onClick={() => setEditing(null)}>رجوع</button>
      </form>
    );
  }

  return (
    <div>
      <h3 className="section-title">الأسماء ({ar(participants.length)} من ٣٠)</h3>
      {message && <div className="success-msg">{message}</div>}
      {error && <div className="error-msg">{error}</div>}

      {bulkOpen ? (
        <form className="card" onSubmit={addMany}>
          <label className="big-label" htmlFor="bulk-names">اكتب كل اسم في سطر</label>
          <textarea id="bulk-names" className="big-input" value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
          <button type="submit" className="btn btn-big btn-primary" disabled={busy}>إضافة الأسماء</button>
          <button type="button" className="btn btn-big btn-secondary" onClick={() => setBulkOpen(false)}>رجوع</button>
        </form>
      ) : (
        <>
          <form className="card" onSubmit={addOne}>
            <label className="big-label" htmlFor="new-name">اسم جديد</label>
            <input id="new-name" className="big-input" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button type="submit" className="btn btn-big btn-primary" disabled={busy}>إضافة</button>
          </form>
          <button className="btn btn-big btn-secondary" onClick={() => setBulkOpen(true)}>
            إضافة عدة أسماء مرة واحدة
          </button>
        </>
      )}

      <div className="big-list">
        {sorted.map((p, i) => (
          <div key={p._id} className="big-row">
            <span className="big-row-main">{ar(i + 1)}. {p.name}</span>
            <div className="row-actions">
              <button className="btn btn-secondary" onClick={() => { setEditing(p); setEditName(p.name); }} disabled={busy}>تعديل</button>
              <button className="btn btn-danger" onClick={() => setToDelete(p)} disabled={busy}>حذف</button>
              {!khatma.is_quick && (
                <>
                  <button className="btn btn-secondary" onClick={() => move(i, -1)} disabled={busy || i === 0}>▲ تقديم</button>
                  <button className="btn btn-secondary" onClick={() => move(i, 1)} disabled={busy || i === sorted.length - 1}>▼ تأخير</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <BackButton to=".." />

      {toDelete && (
        <ConfirmDialog
          message={`هل أنت متأكد أنك تريد حذف ${toDelete.name}؟`}
          confirmLabel="نعم، احذف"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

export default NamesScreen;
