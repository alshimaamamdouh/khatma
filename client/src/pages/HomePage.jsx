import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getActive } from '../utils/storage';
import { khatmaPath } from '../utils/links';

function HomePage() {
  const navigate = useNavigate();
  const active = getActive();
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('الرجاء كتابة رمز الختمة');
      return;
    }
    navigate(khatmaPath(code.trim()));
  };

  return (
    <div>
      <div className="bismillah">بسم الله الرحمن الرحيم</div>

      {active?.code && (
        <Link to={khatmaPath(active.code)} className="btn btn-big btn-primary">
          ↩️ العودة إلى: {active.name || 'ختمتي'}
        </Link>
      )}

      <p className="home-intro">هنا تنظّم ختم القرآن الكريم مع عائلتك وأحبابك، وكل شخص يقرأ جزءًا.</p>

      <Link to="/create" className={`btn btn-big ${active?.code ? 'btn-secondary' : 'btn-primary'}`}>
        ➕ إنشاء ختمة جديدة
      </Link>

      <p className="hint">إذا وصلك رابط ختمة على واتساب، اضغط عليه مباشرة.</p>

      {showCode ? (
        <form className="card" onSubmit={handleSubmit}>
          <label className="big-label" htmlFor="home-code">رمز الختمة</label>
          <input id="home-code" className="big-input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn btn-big btn-primary">دخول</button>
        </form>
      ) : (
        <button className="btn btn-big btn-secondary" onClick={() => setShowCode(true)}>
          عندك رمز الختمة؟ اكتبه هنا
        </button>
      )}

      <Link to="/manage-login" className="link-button">دخول المنظم بالرمز وكلمة المرور</Link>
    </div>
  );
}

export default HomePage;
