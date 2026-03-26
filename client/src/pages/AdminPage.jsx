import { useState } from 'react';
import { api } from '../api/client';

function AdminPage() {
  const [step, setStep] = useState('create'); // 'create' | 'manage'
  const [khatmaId, setKhatmaId] = useState(null);
  const [accessCode, setAccessCode] = useState('');

  // Create form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Participants
  const [participants, setParticipants] = useState([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantSlot, setNewParticipantSlot] = useState('');

  // Deceased
  const [deceasedList, setDeceasedList] = useState([]);
  const [newDeceasedName, setNewDeceasedName] = useState('');
  const [newDeceasedDate, setNewDeceasedDate] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name || !code || !startDate) {
      setError('جميع الحقول مطلوبة');
      return;
    }

    try {
      const result = await api.createKhatma({
        name,
        accessCode: code,
        startDate
      });
      setKhatmaId(result.id);
      setAccessCode(code);
      localStorage.setItem('khatmaCode', code);
      localStorage.setItem('khatmaId', result.id);
      setSuccess('تم إنشاء الختمة بنجاح!');
      setStep('manage');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddParticipant = async (e) => {
    e.preventDefault();
    setError('');

    if (!newParticipantName || !newParticipantSlot) {
      setError('الاسم ورقم الترتيب مطلوبان');
      return;
    }

    try {
      await api.addParticipant(khatmaId, {
        name: newParticipantName,
        slotNumber: Number(newParticipantSlot)
      });
      setParticipants([...participants, {
        name: newParticipantName,
        slot_number: Number(newParticipantSlot)
      }]);
      setNewParticipantName('');
      setNewParticipantSlot('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddDeceased = async (e) => {
    e.preventDefault();
    setError('');

    if (!newDeceasedName || !newDeceasedDate) {
      setError('الاسم وتاريخ الوفاة مطلوبان');
      return;
    }

    try {
      await api.addDeceased(khatmaId, {
        name: newDeceasedName,
        deathDate: newDeceasedDate
      });
      setDeceasedList([...deceasedList, {
        name: newDeceasedName,
        death_date: newDeceasedDate
      }]);
      setNewDeceasedName('');
      setNewDeceasedDate('');
    } catch (err) {
      setError(err.message);
    }
  };

  // Get available slots (1-30 minus already taken)
  const takenSlots = new Set(participants.map(p => p.slot_number));
  const availableSlots = Array.from({ length: 30 }, (_, i) => i + 1)
    .filter(n => !takenSlots.has(n));

  if (step === 'create') {
    return (
      <div>
        <div className="card">
          <h2 className="card-title">إنشاء ختمة جديدة</h2>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>اسم الختمة</label>
              <input
                type="text"
                placeholder="مثال: ختمة عائلة الأحمد"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>رمز الدخول (يُشارك مع المشاركين)</label>
              <input
                type="text"
                placeholder="مثال: KHATMA123"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>تاريخ بداية الختمة</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              إنشاء الختمة
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2 className="card-title">إدارة الختمة</h2>
        {success && <div className="success-msg">{success}</div>}
        {error && <div className="error-msg">{error}</div>}

        <p style={{ textAlign: 'center', marginBottom: 8 }}>رمز الدخول:</p>
        <div className="access-code-display">{accessCode}</div>
        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-light)' }}>
          شارك هذا الرمز مع المشاركين للدخول إلى الختمة
        </p>
      </div>

      {/* Add Participants */}
      <div className="card admin-section">
        <h3>إضافة المشاركين ({participants.length}/30)</h3>

        <form onSubmit={handleAddParticipant} className="inline-form">
          <div className="form-group">
            <input
              type="text"
              placeholder="اسم المشارك"
              value={newParticipantName}
              onChange={(e) => setNewParticipantName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ maxWidth: 120 }}>
            <select
              value={newParticipantSlot}
              onChange={(e) => setNewParticipantSlot(e.target.value)}
            >
              <option value="">الترتيب</option>
              {availableSlots.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">إضافة</button>
        </form>

        {participants.length > 0 && (
          <ul className="admin-list" style={{ marginTop: 12 }}>
            {participants
              .sort((a, b) => a.slot_number - b.slot_number)
              .map((p, i) => (
                <li key={i}>
                  <span>#{p.slot_number} - {p.name}</span>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Add Deceased */}
      <div className="card admin-section">
        <h3>إضافة المتوفين</h3>

        <form onSubmit={handleAddDeceased} className="inline-form">
          <div className="form-group">
            <input
              type="text"
              placeholder="اسم المتوفى"
              value={newDeceasedName}
              onChange={(e) => setNewDeceasedName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <input
              type="date"
              value={newDeceasedDate}
              onChange={(e) => setNewDeceasedDate(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">إضافة</button>
        </form>

        {deceasedList.length > 0 && (
          <ul className="admin-list" style={{ marginTop: 12 }}>
            {deceasedList.map((d, i) => (
              <li key={i}>
                <span>{d.name} - {new Date(d.death_date).toLocaleDateString('ar-EG')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AdminPage;
