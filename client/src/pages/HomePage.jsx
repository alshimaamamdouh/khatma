import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';

function HomePage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedCode = localStorage.getItem('khatmaCode');
    const savedId = localStorage.getItem('khatmaId');
    if (savedCode && savedId) {
      navigate(`/khatma/${savedId}/dashboard`);
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('الرجاء إدخال رمز الختمة');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api.access(code.trim());
      localStorage.setItem('khatmaCode', code.trim());
      localStorage.setItem('khatmaId', data.khatma._id);
      localStorage.setItem('khatmaName', data.khatma.name);
      navigate(`/khatma/${data.khatma._id}/dashboard`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">
      <div className="bismillah">بسم الله الرحمن الرحيم</div>

      <div className="card access-form">
        <h2 className="card-title">الدخول إلى الختمة</h2>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              placeholder="أدخل رمز الختمة"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>

        <div className="home-links">
          <Link to="/admin/create" className="btn btn-primary btn-sm">
            إنشاء ختمة جديدة
          </Link>
          <Link to="/admin/manage" className="btn btn-secondary btn-sm">
            إدارة ختمة موجودة
          </Link>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
