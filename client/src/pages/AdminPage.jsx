import { useState } from 'react';
import { api } from '../api/client';

function AdminPage() {
  const [step, setStep] = useState('choose'); // 'choose' | 'create' | 'login' | 'manage'
  const [khatmaId, setKhatmaId] = useState(null);
  const [khatmaData, setKhatmaData] = useState(null);
  const [accessCode, setAccessCode] = useState('');

  // Create form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Rotation
  const [rotationType, setRotationType] = useState('weekly');
  const [customDays, setCustomDays] = useState('');

  // Login form
  const [loginCode, setLoginCode] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // State
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Participants
  const [participants, setParticipants] = useState([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantSlot, setNewParticipantSlot] = useState('');
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editParticipantName, setEditParticipantName] = useState('');

  // Deceased
  const [deceasedList, setDeceasedList] = useState([]);
  const [newDeceasedName, setNewDeceasedName] = useState('');
  const [newDeceasedDate, setNewDeceasedDate] = useState('');
  const [editingDeceased, setEditingDeceased] = useState(null);
  const [editDeceasedName, setEditDeceasedName] = useState('');
  const [editDeceasedDate, setEditDeceasedDate] = useState('');

  // Edit Khatma
  const [editKhatmaName, setEditKhatmaName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [showEditKhatma, setShowEditKhatma] = useState(false);

  // Pause
  const [pausedFrom, setPausedFrom] = useState('');
  const [pausedTo, setPausedTo] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name || !code || !adminPassword || !startDate) {
      setError('جميع الحقول مطلوبة');
      return;
    }

    try {
      const result = await api.createKhatma({
        name,
        accessCode: code,
        adminPassword,
        startDate,
        rotationType,
        customDays: rotationType === 'custom' ? Number(customDays) : null
      });
      setKhatmaId(result.id);
      setAccessCode(code);
      localStorage.setItem('khatmaCode', code);
      localStorage.setItem('khatmaId', result.id);
      localStorage.setItem('adminPassword', adminPassword);
      setKhatmaData({ name, start_date: startDate });
      setEditKhatmaName(name);
      setEditStartDate(startDate);
      setSuccess('تم إنشاء الختمة بنجاح!');
      setStep('manage');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!loginCode || !loginPassword) {
      setError('رمز الختمة وكلمة مرور المسؤول مطلوبان');
      return;
    }

    try {
      const data = await api.adminLogin(loginCode, loginPassword);
      setKhatmaId(data.khatma._id);
      setAccessCode(data.khatma.access_code);
      setKhatmaData(data.khatma);
      setParticipants(data.participants);
      setDeceasedList(data.deceased);
      setEditKhatmaName(data.khatma.name);
      setEditStartDate(data.khatma.start_date);
      setRotationType(data.khatma.rotation_type || 'weekly');
      setCustomDays(data.khatma.custom_days || '');
      setPausedFrom(data.khatma.paused_from || '');
      setPausedTo(data.khatma.paused_to || '');
      localStorage.setItem('khatmaCode', data.khatma.access_code);
      localStorage.setItem('khatmaId', data.khatma._id);
      localStorage.setItem('adminPassword', loginPassword);
      setStep('manage');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateKhatma = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.updateKhatma(khatmaId, {
        name: editKhatmaName,
        startDate: editStartDate,
        rotationType,
        customDays: rotationType === 'custom' ? Number(customDays) : null
      });
      setKhatmaData({ ...khatmaData, name: editKhatmaName, start_date: editStartDate, rotation_type: rotationType, custom_days: customDays });
      setSuccess('تم تحديث بيانات الختمة');
      setShowEditKhatma(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePause = async (e) => {
    e.preventDefault();
    setError('');

    if (!pausedFrom || !pausedTo) {
      setError('تاريخ البداية والنهاية مطلوبان');
      return;
    }

    try {
      await api.updateKhatma(khatmaId, { pausedFrom, pausedTo });
      setKhatmaData({ ...khatmaData, paused_from: pausedFrom, paused_to: pausedTo });
      setSuccess('تم إيقاف الختمة مؤقتاً');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResume = async () => {
    setError('');
    try {
      await api.updateKhatma(khatmaId, { pausedFrom: '', pausedTo: '' });
      setPausedFrom('');
      setPausedTo('');
      setKhatmaData({ ...khatmaData, paused_from: null, paused_to: null });
      setSuccess('تم استئناف الختمة');
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
      const result = await api.addParticipant(khatmaId, {
        name: newParticipantName,
        slotNumber: Number(newParticipantSlot)
      });
      setParticipants([...participants, {
        _id: result.participant._id,
        name: newParticipantName,
        slot_number: Number(newParticipantSlot)
      }]);
      setNewParticipantName('');
      setNewParticipantSlot('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateParticipant = async (pid) => {
    setError('');
    try {
      await api.updateParticipant(khatmaId, pid, { name: editParticipantName });
      setParticipants(participants.map(p =>
        p._id === pid ? { ...p, name: editParticipantName } : p
      ));
      setEditingParticipant(null);
      setEditParticipantName('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteParticipant = async (pid) => {
    setError('');
    try {
      await api.deleteParticipant(khatmaId, pid);
      setParticipants(participants.filter(p => p._id !== pid));
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
      const result = await api.addDeceased(khatmaId, {
        name: newDeceasedName,
        deathDate: newDeceasedDate
      });
      setDeceasedList([...deceasedList, {
        _id: result.deceased._id,
        name: newDeceasedName,
        death_date: newDeceasedDate
      }]);
      setNewDeceasedName('');
      setNewDeceasedDate('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateDeceased = async (did) => {
    setError('');
    try {
      await api.updateDeceased(khatmaId, did, {
        name: editDeceasedName,
        deathDate: editDeceasedDate
      });
      setDeceasedList(deceasedList.map(d =>
        d._id === did ? { ...d, name: editDeceasedName, death_date: editDeceasedDate } : d
      ));
      setEditingDeceased(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteDeceased = async (did) => {
    setError('');
    try {
      await api.deleteDeceased(khatmaId, did);
      setDeceasedList(deceasedList.filter(d => d._id !== did));
    } catch (err) {
      setError(err.message);
    }
  };

  const takenSlots = new Set(participants.map(p => p.slot_number));
  const availableSlots = Array.from({ length: 30 }, (_, i) => i + 1)
    .filter(n => !takenSlots.has(n));

  // Choose: create or login
  if (step === 'choose') {
    return (
      <div className="home-page">
        <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <h2 className="card-title">لوحة الإدارة</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="btn btn-primary btn-block" onClick={() => setStep('create')}>
              إنشاء ختمة جديدة
            </button>
            <button className="btn btn-secondary btn-block" onClick={() => setStep('login')}>
              إدارة ختمة موجودة
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Create new Khatma
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
              <label>كلمة مرور المسؤول (خاصة بك فقط)</label>
              <input
                type="password"
                placeholder="كلمة مرور لإدارة الختمة"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
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

            <div className="form-group">
              <label>مدة التكرار</label>
              <select
                value={rotationType}
                onChange={(e) => setRotationType(e.target.value)}
              >
                <option value="daily">يومياً</option>
                <option value="weekly">أسبوعياً</option>
                <option value="biweekly">كل أسبوعين</option>
                <option value="monthly">شهرياً</option>
                <option value="custom">مدة مخصصة</option>
              </select>
            </div>

            {rotationType === 'custom' && (
              <div className="form-group">
                <label>عدد الأيام</label>
                <input
                  type="number"
                  min="1"
                  placeholder="مثال: 10"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block">
              إنشاء الختمة
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setStep('choose')}>
              رجوع
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin login
  if (step === 'login') {
    return (
      <div className="home-page">
        <div className="card" style={{ maxWidth: 400 }}>
          <h2 className="card-title">دخول المسؤول</h2>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleAdminLogin}>
            <div className="form-group">
              <label>رمز الختمة</label>
              <input
                type="text"
                placeholder="أدخل رمز الختمة"
                value={loginCode}
                onChange={(e) => setLoginCode(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>كلمة مرور المسؤول</label>
              <input
                type="password"
                placeholder="أدخل كلمة مرور المسؤول"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              دخول
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setStep('choose')}>
              رجوع
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Management page
  return (
    <div>
      {/* Khatma Info */}
      <div className="card">
        <h2 className="card-title">إدارة: {khatmaData?.name}</h2>
        {success && <div className="success-msg">{success}</div>}
        {error && <div className="error-msg">{error}</div>}

        <p style={{ textAlign: 'center', marginBottom: 8 }}>رمز الدخول للمشاركين:</p>
        <div className="access-code-display">{accessCode}</div>

        {!showEditKhatma ? (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowEditKhatma(true)}>
              تعديل بيانات الختمة
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdateKhatma} style={{ marginTop: 16 }}>
            <div className="form-group">
              <label>اسم الختمة</label>
              <input
                type="text"
                value={editKhatmaName}
                onChange={(e) => setEditKhatmaName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>تاريخ البداية</label>
              <input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>مدة التكرار</label>
              <select
                value={rotationType}
                onChange={(e) => setRotationType(e.target.value)}
              >
                <option value="daily">يومياً</option>
                <option value="weekly">أسبوعياً</option>
                <option value="biweekly">كل أسبوعين</option>
                <option value="monthly">شهرياً</option>
                <option value="custom">مدة مخصصة</option>
              </select>
            </div>
            {rotationType === 'custom' && (
              <div className="form-group">
                <label>عدد الأيام</label>
                <input
                  type="number"
                  min="1"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary">حفظ</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditKhatma(false)}>إلغاء</button>
            </div>
          </form>
        )}
      </div>

      {/* Pause/Resume */}
      <div className="card admin-section">
        <h3>إيقاف مؤقت للختمة</h3>
        {khatmaData?.paused_from && khatmaData?.paused_to ? (
          <div>
            <div className="paused-banner" style={{ marginBottom: 12 }}>
              الختمة متوقفة مؤقتاً
              <div className="paused-dates">
                من {new Date(khatmaData.paused_from).toLocaleDateString('ar-EG')} إلى {new Date(khatmaData.paused_to).toLocaleDateString('ar-EG')}
              </div>
            </div>
            <button className="btn btn-primary btn-block" onClick={handleResume}>
              استئناف الختمة
            </button>
          </div>
        ) : (
          <form onSubmit={handlePause}>
            <p style={{ marginBottom: 12, color: 'var(--text-light)', fontSize: '0.9rem' }}>
              يمكنك إيقاف الختمة مؤقتاً خلال فترة معينة (مثل رمضان). لن يتغير توزيع الأجزاء خلال فترة التوقف.
            </p>
            <div className="inline-form">
              <div className="form-group">
                <label>من تاريخ</label>
                <input
                  type="date"
                  value={pausedFrom}
                  onChange={(e) => setPausedFrom(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>إلى تاريخ</label>
                <input
                  type="date"
                  value={pausedTo}
                  onChange={(e) => setPausedTo(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-danger">إيقاف</button>
            </div>
          </form>
        )}
      </div>

      {/* Participants Management */}
      <div className="card admin-section">
        <h3>المشاركون ({participants.length}/30)</h3>

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
            {[...participants]
              .sort((a, b) => a.slot_number - b.slot_number)
              .map((p) => (
                <li key={p._id}>
                  {editingParticipant === p._id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                      <input
                        type="text"
                        value={editParticipantName}
                        onChange={(e) => setEditParticipantName(e.target.value)}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => handleUpdateParticipant(p._id)}>حفظ</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingParticipant(null)}>إلغاء</button>
                    </div>
                  ) : (
                    <>
                      <span>#{p.slot_number} - {p.name}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setEditingParticipant(p._id); setEditParticipantName(p.name); }}
                        >
                          تعديل
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteParticipant(p._id)}
                        >
                          حذف
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Deceased Management */}
      <div className="card admin-section">
        <h3>المتوفون</h3>

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
            {deceasedList.map((d) => (
              <li key={d._id}>
                {editingDeceased === d._id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={editDeceasedName}
                      onChange={(e) => setEditDeceasedName(e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', minWidth: 120 }}
                    />
                    <input
                      type="date"
                      value={editDeceasedDate}
                      onChange={(e) => setEditDeceasedDate(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => handleUpdateDeceased(d._id)}>حفظ</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingDeceased(null)}>إلغاء</button>
                  </div>
                ) : (
                  <>
                    <span>{d.name} - {new Date(d.death_date).toLocaleDateString('ar-EG')}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingDeceased(d._id);
                          setEditDeceasedName(d.name);
                          setEditDeceasedDate(d.death_date);
                        }}
                      >
                        تعديل
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteDeceased(d._id)}
                      >
                        حذف
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AdminPage;
