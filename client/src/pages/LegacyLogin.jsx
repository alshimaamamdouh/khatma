import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { saveKhatma, setActive } from '../utils/storage';
import { khatmaPath } from '../utils/links';
import BackButton from '../components/BackButton';

// For khatmas created before links existed: code + admin password
function LegacyLogin() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim() || !password) {
      setError('الرجاء كتابة الرمز وكلمة المرور');
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await api.adminLogin(code.trim(), password);
      saveKhatma(data.khatma._id, { code: data.khatma.access_code, adminPassword: password, name: data.khatma.name });
      setActive(data.khatma._id);
      navigate(`${khatmaPath(data.khatma.access_code)}/manage`);
    } catch (err) {
      setError(err.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="khatma-title">دخول المنظم</h2>
      <form className="card" onSubmit={handleSubmit}>
        <label className="big-label" htmlFor="legacy-code">رمز الختمة</label>
        <input id="legacy-code" className="big-input" value={code} onChange={(e) => setCode(e.target.value)} />
        <label className="big-label" htmlFor="legacy-password">كلمة مرور المسؤول</label>
        <input
          id="legacy-password"
          className="big-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="error-msg">{error}</div>}
        <button type="submit" className="btn btn-big btn-primary" disabled={busy}>
          {busy ? 'جاري الدخول…' : 'دخول'}
        </button>
      </form>
      <BackButton to="/" />
    </div>
  );
}

export default LegacyLogin;
