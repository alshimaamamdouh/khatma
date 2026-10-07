import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { generateCode, generatePassword, khatmaPath } from '../utils/links';
import { saveKhatma, setActive } from '../utils/storage';
import ShareButtons from '../components/ShareButtons';
import BackButton from '../components/BackButton';

const SCHEDULES = [
  ['daily', 'كل يوم'],
  ['weekly', 'كل أسبوع'],
  ['biweekly', 'كل أسبوعين'],
  ['monthly', 'كل شهر']
];

// Local date (YYYY-MM-DD); toISOString() would give the UTC date
const today = () => {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function CreateKhatma() {
  const [isQuick, setIsQuick] = useState(null); // null = choosing
  const [name, setName] = useState('');
  const [rotationType, setRotationType] = useState('weekly');
  const [phone, setPhone] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [startDate, setStartDate] = useState(today());
  const [customDays, setCustomDays] = useState('');
  const [useHijri, setUseHijri] = useState(false);
  const [khatmaNumber, setKhatmaNumber] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const busyRef = useRef(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('الرجاء كتابة اسم الختمة');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');

    const custom = Math.floor(Number(customDays));
    const payload = {
      name: name.trim(),
      organizerPhone: phone,
      isQuick,
      startDate: isQuick ? today() : startDate,
      rotationType: isQuick ? 'weekly' : (custom >= 1 ? 'custom' : rotationType),
      customDays: !isQuick && custom >= 1 ? custom : null,
      useHijri: isQuick ? false : useHijri,
      khatmaNumber: isQuick ? 1 : (Number(khatmaNumber) || 1)
    };

    try {
      let code;
      let password;
      let result;
      // A random code collision is very unlikely; retry once if it happens
      for (let attempt = 0; attempt < 2; attempt++) {
        code = generateCode();
        password = generatePassword();
        try {
          result = await api.createKhatma({ ...payload, accessCode: code, adminPassword: password });
          break;
        } catch (err) {
          if (err.status !== 409 || attempt === 1) throw err;
        }
      }
      saveKhatma(result.id, { code, adminPassword: password, name: payload.name });
      setActive(result.id);
      setCreated({ code, password, name: payload.name, isQuick });
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (created) {
    return (
      <div className="card center-text">
        <h2 className="success-title">تم إنشاء الختمة بنجاح 🌷</h2>
        {!created.isQuick && (
          <>
            <p className="big-text">الخطوة التالية: أضف أسماء المشاركين</p>
            <Link to={`${khatmaPath(created.code)}/manage/names`} className="btn btn-big btn-primary">
              👥 أضف الأسماء
            </Link>
          </>
        )}
        <ShareButtons name={created.name} code={created.code} password={created.password} />
        <Link to={khatmaPath(created.code)} className="link-button">فتح الختمة</Link>
      </div>
    );
  }

  if (isQuick === null) {
    return (
      <div>
        <h2 className="khatma-title">كيف تريد الختمة؟</h2>
        <button className="choice-card" onClick={() => setIsQuick(true)}>
          <div className="choice-card-title">كل شخص يختار جزءه بنفسه</div>
          <div className="choice-card-desc">ترسل الرابط، وكل شخص يضغط على جزء متاح ويكتب اسمه.</div>
        </button>
        <button className="choice-card" onClick={() => setIsQuick(false)}>
          <div className="choice-card-title">أنا أكتب الأسماء، والأجزاء تتغير كل فترة</div>
          <div className="choice-card-desc">تكتب أسماء العائلة، والموقع يوزّع الأجزاء ويغيّرها تلقائيًا، مع الإهداء للمتوفين.</div>
        </button>
        <BackButton to="/" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="khatma-title">ختمة جديدة</h2>
      <form className="card" onSubmit={handleCreate}>
        <label className="big-label" htmlFor="create-name">اسم الختمة</label>
        <input
          id="create-name"
          className="big-input"
          placeholder="مثال: ختمة عائلة الأحمد"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {!isQuick && (
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend className="big-label">متى تتغير الأجزاء؟</legend>
            {SCHEDULES.map(([value, label]) => (
              <label key={value} className={`radio-row ${rotationType === value ? 'selected' : ''}`}>
                <input type="radio" name="schedule" value={value} checked={rotationType === value} onChange={() => setRotationType(value)} />
                {label}
              </label>
            ))}
          </fieldset>
        )}

        <label className="big-label" htmlFor="create-phone">رقم واتساب للمساعدة (اختياري)</label>
        <input id="create-phone" className="big-input" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <p className="hint">ليتواصل معك المشاركون إذا احتاجوا مساعدة. مع مفتاح الدولة، مثال: 973xxxxxxxx</p>

        {!isQuick && (
          <>
            <button type="button" className="btn btn-big btn-secondary" onClick={() => setShowMore(!showMore)} aria-expanded={showMore}>
              {showMore ? 'إخفاء الخيارات الإضافية ▲' : 'خيارات إضافية ▼'}
            </button>
            {showMore && (
              <div>
                <label className="big-label" htmlFor="create-start">تاريخ بداية الختمة</label>
                <input id="create-start" className="big-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <label className="big-label" htmlFor="create-days">عدد أيام مخصص (بدل الاختيارات أعلاه)</label>
                <input id="create-days" className="big-input" type="number" min="1" value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
                <label className={`radio-row ${useHijri ? 'selected' : ''}`}>
                  <input type="checkbox" checked={useHijri} onChange={(e) => setUseHijri(e.target.checked)} />
                  عرض التواريخ بالتقويم الهجري
                </label>
                <label className="big-label" htmlFor="create-number">رقم الختمة الأولى</label>
                <input id="create-number" className="big-input" type="number" min="1" value={khatmaNumber} onChange={(e) => setKhatmaNumber(e.target.value)} />
              </div>
            )}
          </>
        )}

        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>
          {busy ? 'جاري الإنشاء…' : 'إنشاء الختمة'}
        </button>
      </form>
      <button className="link-button" onClick={() => setIsQuick(null)}>رجوع</button>
    </div>
  );
}

export default CreateKhatma;
