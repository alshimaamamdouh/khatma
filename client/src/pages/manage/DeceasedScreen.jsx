import { useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api/client';
import { formatDate } from '../../utils/hijriDate';
import ConfirmDialog from '../../components/ConfirmDialog';
import BackButton from '../../components/BackButton';

function DeceasedScreen() {
  const { khatma, khatmaId, deceased, reload } = useOutletContext();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async (action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const add = (e) => {
    e.preventDefault();
    if (!name.trim() || !date) return setError('الرجاء كتابة الاسم وتاريخ الوفاة');
    run(async () => {
      await api.addDeceased(khatmaId, { name: name.trim(), deathDate: date });
      setName('');
      setDate('');
    });
  };

  const saveEdit = (e) => {
    e.preventDefault();
    if (!editName.trim() || !editDate) return setError('الرجاء كتابة الاسم وتاريخ الوفاة');
    run(async () => {
      await api.updateDeceased(khatmaId, editing._id, { name: editName.trim(), deathDate: editDate });
      setEditing(null);
    });
  };

  const confirmDelete = () => {
    const d = toDelete;
    setToDelete(null);
    run(() => api.deleteDeceased(khatmaId, d._id));
  };

  if (editing) {
    return (
      <form className="card" onSubmit={saveEdit}>
        <label className="big-label" htmlFor="edit-dec-name">الاسم</label>
        <input id="edit-dec-name" className="big-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
        <label className="big-label" htmlFor="edit-dec-date">تاريخ الوفاة</label>
        <input id="edit-dec-date" className="big-input" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>حفظ</button>
        <button type="button" className="btn btn-big btn-secondary" onClick={() => setEditing(null)}>رجوع</button>
      </form>
    );
  }

  return (
    <div>
      <h3 className="section-title">الإهداء للمتوفين</h3>
      <p className="hint">كل ختمة تُهدى لواحد منهم بالترتيب، ولمن تقترب ذكرى وفاته.</p>
      {error && <div className="error-msg">{error}</div>}

      <form className="card" onSubmit={add}>
        <label className="big-label" htmlFor="dec-name">اسم المتوفى</label>
        <input id="dec-name" className="big-input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="big-label" htmlFor="dec-date">تاريخ الوفاة</label>
        <input id="dec-date" className="big-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>إضافة</button>
      </form>

      <div className="big-list">
        {deceased.map(d => (
          <div key={d._id} className="big-row">
            <span className="big-row-main">{d.name}</span>
            <span>{formatDate(d.death_date, khatma.use_hijri)}</span>
            <div className="row-actions">
              <button
                className="btn btn-secondary"
                onClick={() => { setEditing(d); setEditName(d.name); setEditDate(String(d.death_date).slice(0, 10)); }}
                disabled={busy}
              >
                تعديل
              </button>
              <button className="btn btn-danger" onClick={() => setToDelete(d)} disabled={busy}>حذف</button>
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

export default DeceasedScreen;
