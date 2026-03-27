import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

function CreateKhatma() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [rotationType, setRotationType] = useState('weekly');
  const [customDays, setCustomDays] = useState('');
  const [useHijri, setUseHijri] = useState(false);
  const [khatmaNumber, setKhatmaNumber] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        customDays: rotationType === 'custom' ? Number(customDays) : null,
        useHijri,
        khatmaNumber: Number(khatmaNumber)
      });
      localStorage.setItem('khatmaCode', code);
      localStorage.setItem('khatmaId', result.id);
      localStorage.setItem('adminPassword', adminPassword);
      setSuccess('تم إنشاء الختمة بنجاح!');
      setTimeout(() => navigate('/admin/manage'), 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="card">
        <h2 className="card-title">إنشاء ختمة جديدة</h2>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

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
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="كلمة مرور لإدارة الختمة"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '\u{1F648}' : '\u{1F441}'}
              </button>
            </div>
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
            <label>رقم الختمة (يبدأ من هذا الرقم ويزيد تلقائياً)</label>
            <input
              type="number"
              min="1"
              value={khatmaNumber}
              onChange={(e) => setKhatmaNumber(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            إنشاء الختمة
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

export default CreateKhatma;
