import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

function HistoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCycle, setExpandedCycle] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.getHistory(id);
        setHistory(data.history);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [id]);

  if (loading) return <div className="loading">جاري التحميل...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div>
      <div className="card">
        <h2 className="card-title">سجل الختمات السابقة</h2>
      </div>

      {history.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-light)' }}>
          لا يوجد سجل بعد
        </div>
      ) : (
        history.map((cycle) => (
          <div key={cycle.cycle} className={`card history-card ${cycle.allCompleted ? 'history-completed' : ''}`}>
            <div
              className="history-header"
              onClick={() => setExpandedCycle(expandedCycle === cycle.cycle ? null : cycle.cycle)}
              style={{ cursor: 'pointer' }}
            >
              <div className="history-title">
                <span className="history-khatma-num">الختمة {cycle.khatmaNumber}</span>
                {cycle.allCompleted && <span className="history-badge">مكتملة</span>}
                {!cycle.allCompleted && cycle.completedCount > 0 && (
                  <span className="history-badge history-badge-partial">
                    {cycle.completedCount}/{cycle.totalParticipants}
                  </span>
                )}
              </div>
              {cycle.dedication.length > 0 && (
                <div className="history-dedication">
                  إهداء: {cycle.dedication.join(' و ')}
                </div>
              )}
              <div className="history-progress-mini">
                <div
                  className="progress-fill"
                  style={{ width: cycle.totalParticipants > 0 ? `${(cycle.completedCount / cycle.totalParticipants) * 100}%` : '0%' }}
                />
              </div>
            </div>

            {expandedCycle === cycle.cycle && (
              <div className="history-details">
                <div className="history-participants-grid">
                  {cycle.participants.map((p, i) => (
                    <div key={i} className={`history-participant ${p.completed ? 'hp-completed' : ''}`}>
                      <span className="hp-juz">جزء {p.juz}</span>
                      <span className="hp-name">{p.name}</span>
                      <span className={`hp-status ${p.completed ? 'done' : 'pending'}`}>
                        {p.completed ? 'انتهى' : 'لم ينته'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button className="btn btn-secondary" onClick={() => navigate(`/khatma/${id}/dashboard`)}>
          العودة للوحة
        </button>
      </div>
    </div>
  );
}

export default HistoryPage;
