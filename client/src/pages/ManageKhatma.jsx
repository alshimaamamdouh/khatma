import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

function ManageKhatma() {
  const navigate = useNavigate();
  const [step, setStep] = useState('login'); // 'login' | 'manage'
  const [khatmaId, setKhatmaId] = useState(null);
  const [khatmaData, setKhatmaData] = useState(null);
  const [accessCode, setAccessCode] = useState('');

  // Login form
  const [loginCode, setLoginCode] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

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

  // Hijri & rotation
  const [useHijri, setUseHijri] = useState(false);
  const [rotationType, setRotationType] = useState('weekly');
  const [customDays, setCustomDays] = useState('');
  const [khatmaNumber, setKhatmaNumber] = useState(1);

  // Bulk add participants
  const [bulkAddMode, setBulkAddMode] = useState(false);
  const [bulkNames, setBulkNames] = useState('');

  // Bulk add deceased
  const [bulkDeceasedMode, setBulkDeceasedMode] = useState(false);
  const [bulkDeceasedText, setBulkDeceasedText] = useState('');

  // Duplicate
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [dupCode, setDupCode] = useState('');
  const [dupPassword, setDupPassword] = useState('');

  // Auto-login if credentials exist
  useEffect(() => {
    const savedCode = localStorage.getItem('khatmaCode');
    const savedPassword = localStorage.getItem('adminPassword');
    if (savedCode && savedPassword) {
      doLogin(savedCode, savedPassword);
    }
  }, []);

  const doLogin = async (code, password) => {
    setError('');
    try {
      const data = await api.adminLogin(code, password);
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
      setUseHijri(data.khatma.use_hijri || false);
      setKhatmaNumber(data.khatma.khatma_number || 1);
      localStorage.setItem('khatmaCode', data.khatma.access_code);
      localStorage.setItem('khatmaId', data.khatma._id);
      localStorage.setItem('adminPassword', password);
      setStep('manage');
    } catch (err) {
      setStep('login');
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
      setUseHijri(data.khatma.use_hijri || false);
      setKhatmaNumber(data.khatma.khatma_number || 1);
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
        customDays: rotationType === 'custom' ? Number(customDays) : null,
        useHijri,
        khatmaNumber: Number(khatmaNumber)
      });
      setKhatmaData({ ...khatmaData, name: editKhatmaName, start_date: editStartDate, rotation_type: rotationType, custom_days: customDays, use_hijri: useHijri, khatma_number: Number(khatmaNumber) });
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

  const handleBulkAdd = async (e) => {
    e.preventDefault();
    setError('');
    const names = bulkNames.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    if (names.length === 0) {
      setError('الرجاء إدخال اسم واحد على الأقل');
      return;
    }

    const currentTaken = new Set(participants.map(p => p.slot_number));
    const currentAvailable = Array.from({ length: 30 }, (_, i) => i + 1).filter(n => !currentTaken.has(n));

    if (names.length > currentAvailable.length) {
      setError(`عدد الأسماء (${names.length}) أكبر من عدد الأماكن الشاغرة (${currentAvailable.length})`);
      return;
    }

    const newParticipants = [];
    for (let i = 0; i < names.length; i++) {
      try {
        const result = await api.addParticipant(khatmaId, {
          name: names[i],
          slotNumber: currentAvailable[i]
        });
        newParticipants.push({
          _id: result.participant._id,
          name: names[i],
          slot_number: currentAvailable[i]
        });
      } catch (err) {
        setError(`خطأ عند إضافة "${names[i]}": ${err.message}`);
        break;
      }
    }
    if (newParticipants.length > 0) {
      setParticipants([...participants, ...newParticipants]);
      setBulkNames('');
      setSuccess(`تمت إضافة ${newParticipants.length} مشارك بنجاح`);
    }
  };

  const handleBulkAddDeceased = async (e) => {
    e.preventDefault();
    setError('');
    const lines = bulkDeceasedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      setError('الرجاء إدخال اسم واحد على الأقل');
      return;
    }

    const newDeceased = [];
    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      const dName = parts[0];
      const dDate = parts[1] || new Date().toISOString().split('T')[0];

      try {
        const result = await api.addDeceased(khatmaId, {
          name: dName,
          deathDate: dDate
        });
        newDeceased.push({
          _id: result.deceased._id,
          name: dName,
          death_date: dDate
        });
      } catch (err) {
        setError(`خطأ عند إضافة "${dName}": ${err.message}`);
        break;
      }
    }
    if (newDeceased.length > 0) {
      setDeceasedList([...deceasedList, ...newDeceased]);
      setBulkDeceasedText('');
      setSuccess(`تمت إضافة ${newDeceased.length} متوفى بنجاح`);
    }
  };

  const handleDuplicate = async (e) => {
    e.preventDefault();
    setError('');
    if (!dupCode || !dupPassword) {
      setError('رمز الدخول وكلمة المرور مطلوبان للنسخة الجديدة');
      return;
    }
    try {
      const result = await api.duplicateKhatma(khatmaId, {
        newAccessCode: dupCode,
        newAdminPassword: dupPassword
      });
      setSuccess(`تم نسخ الختمة بنجاح! رمز الدخول الجديد: ${result.accessCode}`);
      setShowDuplicate(false);
      setDupCode('');
      setDupPassword('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSwap = async (pid, direction) => {
    setError('');
    const sorted = [...participants].sort((a, b) => a.slot_number - b.slot_number);
    const idx = sorted.findIndex(p => p._id === pid);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    const targetPid = sorted[targetIdx]._id;
    try {
      await api.swapParticipants(khatmaId, pid, targetPid);
      setParticipants(participants.map(p => {
        if (p._id === pid) return { ...p, slot_number: sorted[targetIdx].slot_number };
        if (p._id === targetPid) return { ...p, slot_number: sorted[idx].slot_number };
        return p;
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('adminPassword');
    setStep('login');
    setKhatmaId(null);
    setKhatmaData(null);
  };

  const takenSlots = new Set(participants.map(p => p.slot_number));
  const availableSlots = Array.from({ length: 30 }, (_, i) => i + 1)
    .filter(n => !takenSlots.has(n));

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
              <div className="password-field">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  placeholder="أدخل كلمة مرور المسؤول"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                >
                  {showLoginPassword ? '\u{1F648}' : '\u{1F441}'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              دخول
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')}>
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
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useHijri}
                  onChange={(e) => setUseHijri(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                عرض التواريخ بالتقويم الهجري
              </label>
            </div>
            <div className="form-group">
              <label>رقم الختمة الأولي</label>
              <input
                type="number"
                min="1"
                value={khatmaNumber}
                onChange={(e) => setKhatmaNumber(e.target.value)}
              />
            </div>
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

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            className={`btn btn-sm ${!bulkAddMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBulkAddMode(false)}
          >
            إضافة فردية
          </button>
          <button
            className={`btn btn-sm ${bulkAddMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBulkAddMode(true)}
          >
            إضافة مجموعة
          </button>
        </div>

        {!bulkAddMode ? (
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
        ) : (
          <form onSubmit={handleBulkAdd}>
            <div className="form-group">
              <label>أدخل الأسماء (اسم واحد في كل سطر)</label>
              <textarea
                value={bulkNames}
                onChange={(e) => setBulkNames(e.target.value)}
                placeholder={"محمد أحمد\nعلي حسن\nفاطمة محمد"}
                rows={6}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '2px solid var(--border)',
                  borderRadius: 8,
                  fontFamily: "'Tajawal', sans-serif",
                  fontSize: '1rem',
                  direction: 'rtl',
                  resize: 'vertical'
                }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 12 }}>
              سيتم تعيين أرقام الترتيب تلقائياً بدءاً من أول رقم شاغر. الأماكن الشاغرة: {availableSlots.length}
            </p>
            <button type="submit" className="btn btn-primary btn-block">إضافة المجموعة</button>
          </form>
        )}

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
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-reorder" onClick={() => handleSwap(p._id, 'up')} title="تقديم">&#9650;</button>
                        <button className="btn-reorder" onClick={() => handleSwap(p._id, 'down')} title="تأخير">&#9660;</button>
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

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            className={`btn btn-sm ${!bulkDeceasedMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBulkDeceasedMode(false)}
          >
            إضافة فردية
          </button>
          <button
            className={`btn btn-sm ${bulkDeceasedMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBulkDeceasedMode(true)}
          >
            إضافة مجموعة
          </button>
        </div>

        {!bulkDeceasedMode ? (
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
        ) : (
          <form onSubmit={handleBulkAddDeceased}>
            <div className="form-group">
              <label>أدخل الأسماء وتواريخ الوفاة (اسم، تاريخ في كل سطر)</label>
              <textarea
                value={bulkDeceasedText}
                onChange={(e) => setBulkDeceasedText(e.target.value)}
                placeholder={"محمد أحمد, 2020-01-15\nعلي حسن, 2019-06-20\nفاطمة محمد, 2021-03-10"}
                rows={6}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '2px solid var(--border)',
                  borderRadius: 8,
                  fontFamily: "'Tajawal', sans-serif",
                  fontSize: '1rem',
                  direction: 'rtl',
                  resize: 'vertical'
                }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: 12 }}>
              الصيغة: اسم المتوفى, تاريخ الوفاة (YYYY-MM-DD). إذا لم يُذكر التاريخ سيُستخدم تاريخ اليوم.
            </p>
            <button type="submit" className="btn btn-primary btn-block">إضافة المجموعة</button>
          </form>
        )}

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

      {/* Duplicate Khatma */}
      <div className="card admin-section">
        <h3>نسخ الختمة</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', marginBottom: 12 }}>
          إنشاء نسخة جديدة من الختمة بنفس المشاركين والمتوفين مع رمز دخول جديد
        </p>
        {!showDuplicate ? (
          <button className="btn btn-secondary btn-block" onClick={() => setShowDuplicate(true)}>
            نسخ الختمة
          </button>
        ) : (
          <form onSubmit={handleDuplicate}>
            <div className="form-group">
              <label>رمز الدخول للنسخة الجديدة</label>
              <input
                type="text"
                placeholder="رمز جديد"
                value={dupCode}
                onChange={(e) => setDupCode(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>كلمة مرور المسؤول للنسخة الجديدة</label>
              <input
                type="text"
                placeholder="كلمة مرور جديدة"
                value={dupPassword}
                onChange={(e) => setDupPassword(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-primary">نسخ</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDuplicate(false)}>إلغاء</button>
            </div>
          </form>
        )}
      </div>

      {/* Logout */}
      <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 20 }}>
        <button className="btn btn-secondary" onClick={handleAdminLogout}>
          تسجيل خروج المسؤول
        </button>
      </div>
    </div>
  );
}

export default ManageKhatma;
