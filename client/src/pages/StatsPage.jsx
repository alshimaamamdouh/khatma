import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

function StatsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.getStats(id);
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [id]);

  if (loading) return <div className="loading">جاري التحميل...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!stats) return null;

  const sortedByRate = [...stats.participantStats].sort((a, b) => b.rate - a.rate);

  return (
    <div>
      <div className="card">
        <h2 className="card-title">الإحصائيات</h2>
      </div>

      {/* Summary Cards */}
      <div className="stats-summary">
        <div className="stat-card">
          <div className="stat-value">{stats.completedKhatmas}</div>
          <div className="stat-label">ختمات مكتملة</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalCycles}</div>
          <div className="stat-label">إجمالي الدورات</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalParticipants}</div>
          <div className="stat-label">عدد المشاركين</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.streak}</div>
          <div className="stat-label">سلسلة متتالية</div>
        </div>
      </div>

      {/* Completion Rate */}
      {stats.totalCycles > 0 && (
        <div className="card">
          <h3 className="card-title">معدل الإنجاز</h3>
          <div className="stats-overall-rate">
            <div className="stats-rate-circle">
              <span className="stats-rate-value">
                {stats.totalParticipants > 0
                  ? Math.round((stats.completedKhatmas / stats.totalCycles) * 100)
                  : 0}%
              </span>
            </div>
            <div className="stats-rate-label">نسبة الختمات المكتملة</div>
          </div>
        </div>
      )}

      {/* Participant Rankings */}
      <div className="card">
        <h3 className="card-title">ترتيب المشاركين</h3>
        <div className="stats-ranking">
          {sortedByRate.map((p, index) => (
            <div key={index} className="stats-rank-item">
              <div className="rank-position">
                {index === 0 && p.rate > 0 ? '🥇' : index === 1 && p.rate > 0 ? '🥈' : index === 2 && p.rate > 0 ? '🥉' : `#${index + 1}`}
              </div>
              <div className="rank-info">
                <div className="rank-name">{p.name}</div>
                <div className="rank-detail">{p.completedCycles} من {p.totalCycles} دورة</div>
              </div>
              <div className="rank-bar-container">
                <div className="rank-bar">
                  <div className="rank-bar-fill" style={{ width: `${p.rate}%` }} />
                </div>
                <span className="rank-rate">{p.rate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button className="btn btn-secondary" onClick={() => navigate(`/khatma/${id}/dashboard`)}>
          العودة للوحة
        </button>
      </div>
    </div>
  );
}

export default StatsPage;
