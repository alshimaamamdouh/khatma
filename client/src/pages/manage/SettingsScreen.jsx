import { useState, useRef } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { generateCode, generatePassword, khatmaPath } from '../../utils/links';
import { saveKhatma, removeKhatma } from '../../utils/storage';
import ConfirmDialog from '../../components/ConfirmDialog';
import ShareButtons from '../../components/ShareButtons';
import BackButton from '../../components/BackButton';

const SCHEDULES = [
  ['daily', 'كل يوم'],
  ['weekly', 'كل أسبوع'],
  ['biweekly', 'كل أسبوعين'],
  ['monthly', 'كل شهر']
];

function SettingsScreen() {
  const { khatma, khatmaId, reload } = useOutletContext();
  const navigate = useNavigate();
  const [name, setName] = useState(khatma.name);
  const [rotationType, setRotationType] = useState(khatma.rotation_type === 'custom' ? 'weekly' : khatma.rotation_type);
  const [customDays, setCustomDays] = useState(khatma.rotation_type === 'custom' ? String(khatma.custom_days || '') : '');
  const [phone, setPhone] = useState(khatma.organizer_phone || '');
  const [startDate, setStartDate] = useState(khatma.start_date);
  const [useHijri, setUseHijri] = useState(!!khatma.use_hijri);
  const [khatmaNumber, setKhatmaNumber] = useState(khatma.khatma_number || 1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0); // 0 none, 1 first, 2 final
  const [copy, setCopy] = useState(null); // { code, password, name }
  const busyRef = useRef(false);

  // Reloads after every action (success or failure) unless the action navigated away
  const run = async (action, successMessage) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    let left = false;
    try {
      left = (await action()) === 'left';
      if (successMessage) setMessage(successMessage);
    } catch (err) {
      setMessage('');
      setError(err.message);
    } finally {
      if (!left) { try { await reload(); } catch { /* keep the original error */ } }
      busyRef.current = false;
      setBusy(false);
    }
  };

  const save = (e) => {
    e.preventDefault();
    if (!name.trim()) { setMessage(''); return setError('الرجاء كتابة اسم الختمة'); }
    const custom = Number(customDays);
    run(async () => {
      await api.updateKhatma(khatmaId, {
        name: name.trim(),
        organizerPhone: phone,
        ...(khatma.is_quick ? {} : {
          rotationType: custom >= 1 ? 'custom' : rotationType,
          customDays: custom >= 1 ? custom : null,
          startDate,
          useHijri,
          khatmaNumber: Number(khatmaNumber) || 1
        })
      });
      saveKhatma(khatmaId, { name: name.trim() });
    }, 'تم الحفظ');
  };

  const downloadExcel = () => run(async () => {
    const dash = await api.getDashboard(khatmaId);
    const comp = await api.getCompletions(khatmaId, dash.cycleNumber);
    const juzOf = (p) => (khatma.is_quick ? p.slot_number : p.currentJuz);
    const rows = [['الترتيب', 'الاسم', 'الجزء الحالي', 'الحالة']];
    [...dash.participants].sort((a, b) => a.slot_number - b.slot_number).forEach(p => {
      rows.push([p.slot_number, p.name, juzOf(p), comp.completedIds.includes(p._id) ? 'أنهى' : 'لم ينته']);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${khatma.name}_الختمة_${dash.currentKhatmaNumber}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const duplicate = () => run(async () => {
    const newCode = generateCode();
    const newPassword = generatePassword();
    const result = await api.duplicateKhatma(khatmaId, { newAccessCode: newCode, newAdminPassword: newPassword });
    const newName = `${khatma.name} (نسخة)`;
    saveKhatma(result.id, { code: newCode, adminPassword: newPassword, name: newName });
    setCopy({ code: newCode, password: newPassword, name: newName });
  }, 'تم نسخ الختمة');

  const deleteKhatma = () => {
    setConfirmStep(0);
    run(async () => {
      await api.deleteKhatma(khatmaId);
      removeKhatma(khatmaId);
      navigate('/', { replace: true });
      return 'left';
    });
  };

  return (
    <div>
      <h3 className="section-title">الإعدادات</h3>
      {message && <div className="success-msg">{message}</div>}
      {error && <div className="error-msg">{error}</div>}

      <form className="card" onSubmit={save}>
        <label className="big-label" htmlFor="set-name">اسم الختمة</label>
        <input id="set-name" className="big-input" value={name} onChange={(e) => setName(e.target.value)} />

        {!khatma.is_quick && (
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend className="big-label">متى تتغير الأجزاء؟</legend>
            {SCHEDULES.map(([value, label]) => (
              <label key={value} className={`radio-row ${rotationType === value && !customDays ? 'selected' : ''}`}>
                <input type="radio" name="schedule" value={value} checked={rotationType === value && !customDays} onChange={() => { setRotationType(value); setCustomDays(''); }} />
                {label}
              </label>
            ))}
          </fieldset>
        )}

        <label className="big-label" htmlFor="set-phone">رقم واتساب للمساعدة (اختياري)</label>
        <input id="set-phone" className="big-input" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <p className="hint">مع رمز الدولة، مثال: 973xxxxxxxx</p>

        <button type="button" className="btn btn-big btn-secondary" onClick={() => setShowAdvanced(!showAdvanced)} aria-expanded={showAdvanced}>
          {showAdvanced ? 'إخفاء الخيارات المتقدمة ▲' : 'خيارات متقدمة ▼'}
        </button>

        {showAdvanced && !khatma.is_quick && (
          <div>
            <label className="big-label" htmlFor="set-start">تاريخ بداية الختمة</label>
            <input id="set-start" className="big-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <label className="big-label" htmlFor="set-days">عدد أيام مخصص (بدل الاختيارات أعلاه)</label>
            <input id="set-days" className="big-input" type="number" min="1" value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
            <label className={`radio-row ${useHijri ? 'selected' : ''}`}>
              <input type="checkbox" checked={useHijri} onChange={(e) => setUseHijri(e.target.checked)} />
              عرض التواريخ بالتقويم الهجري
            </label>
            <label className="big-label" htmlFor="set-number">رقم الختمة الأولى</label>
            <input id="set-number" className="big-input" type="number" min="1" value={khatmaNumber} onChange={(e) => setKhatmaNumber(e.target.value)} />
          </div>
        )}

        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>حفظ</button>
      </form>

      {showAdvanced && (
        <div className="card">
          <button className="btn btn-big btn-secondary" onClick={downloadExcel} disabled={busy}>⬇️ تنزيل ملف Excel بالأسماء</button>
          <button className="btn btn-big btn-secondary" onClick={duplicate} disabled={busy}>📄 نسخ الختمة (نفس الأسماء والمتوفين)</button>
          {copy && (
            <>
              <ShareButtons name={copy.name} code={copy.code} password={copy.password} />
              <Link to={khatmaPath(copy.code)} className="link-button">فتح النسخة</Link>
            </>
          )}
          <button className="btn btn-big btn-danger" onClick={() => setConfirmStep(1)} disabled={busy}>حذف الختمة</button>
        </div>
      )}

      <BackButton to=".." />

      {confirmStep === 1 && (
        <ConfirmDialog
          message="هل أنت متأكد أنك تريد حذف الختمة كلها؟ ستُحذف الأسماء والسجل."
          confirmLabel="نعم، احذف"
          danger
          onConfirm={() => setConfirmStep(2)}
          onCancel={() => setConfirmStep(0)}
        />
      )}
      {confirmStep === 2 && (
        <ConfirmDialog
          message="هذا لا يمكن التراجع عنه. هل تحذفها نهائيًا؟"
          confirmLabel="نعم، احذف نهائيًا"
          danger
          onConfirm={deleteKhatma}
          onCancel={() => setConfirmStep(0)}
        />
      )}
    </div>
  );
}

export default SettingsScreen;
