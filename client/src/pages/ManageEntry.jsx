import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { saveKhatma, setActive } from '../utils/storage';
import { khatmaPath, readPasswordFromHash } from '../utils/links';

// Opened from the private manage link: /m/<code>#<password>
function ManageEntry() {
  const { code } = useParams();
  const navigate = useNavigate();
  // Read once, before the effect wipes the fragment from the address bar
  const [password] = useState(() => readPasswordFromHash(window.location.hash));
  const [error, setError] = useState('');

  useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname);
    if (!password) {
      setError('رابط الإدارة غير صحيح. تأكد أنك فتحت الرسالة الصحيحة.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.adminLogin(code, password);
        if (cancelled) return;
        saveKhatma(data.khatma._id, { code, adminPassword: password, name: data.khatma.name });
        setActive(data.khatma._id);
        navigate(`${khatmaPath(code)}/manage`, { replace: true });
      } catch {
        if (!cancelled) setError('رابط الإدارة غير صحيح. تأكد أنك فتحت الرسالة الصحيحة.');
      }
    })();
    return () => { cancelled = true; };
  }, [code, password, navigate]);

  if (!error) return <div className="loading">جاري التحميل...</div>;

  return (
    <div className="card center-text">
      <p className="big-text">{error}</p>
      <Link to="/" className="btn btn-big btn-secondary">الصفحة الرئيسية</Link>
    </div>
  );
}

export default ManageEntry;
