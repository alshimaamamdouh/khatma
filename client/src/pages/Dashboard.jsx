import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { getJuzName } from '../utils/juzNames';
import KhatmaGrid from '../components/KhatmaGrid';
import DeceasedInfo from '../components/DeceasedInfo';

function Dashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [completions, setCompletions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const participantId = localStorage.getItem('participantId');
  const participantName = localStorage.getItem('participantName');

  const handleLogout = () => {
    localStorage.removeItem('khatmaCode');
    localStorage.removeItem('khatmaId');
    localStorage.removeItem('khatmaName');
    navigate('/');
  };

  const handleWhatsAppShare = () => {
    const khatmaCode = localStorage.getItem('khatmaCode') || '';
    const khatmaName = data?.khatma?.name || '';
    const appUrl = window.location.origin;
    const text = `ختمة: ${khatmaName}\nرمز الدخول: ${khatmaCode}\nرابط التطبيق: ${appUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const fetchData = async () => {
    try {
      const result = await api.getDashboard(id);
      setData(result);

      const compData = await api.getCompletions(id, result.cycleNumber);
      setCompletions(compData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleMarkComplete = async (pId) => {
    try {
      const result = await api.markComplete(id, {
        participantId: pId,
        cycleNumber: data.cycleNumber
      });
      // Refresh completions
      const compData = await api.getCompletions(id, data.cycleNumber);
      setCompletions(compData);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUndoComplete = async (pId) => {
    try {
      await api.undoComplete(id, {
        participantId: pId,
        cycleNumber: data.cycleNumber
      });
      const compData = await api.getCompletions(id, data.cycleNumber);
      setCompletions(compData);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">جاري التحميل...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return null;

  const myAssignment = participantId
    ? data.participants.find(p => p._id === participantId || p.id === Number(participantId))
    : null;

  const isCompleted = (pId) => completions?.completedIds?.includes(pId);

  return (
    <div>
      <div className="card">
        <h2 className="card-title">{data.khatma.name}</h2>
        <div className="week-info">
          الختمة رقم <strong>{data.currentKhatmaNumber}</strong> — الدورة <strong>{data.cycleNumber}</strong> — التكرار: {data.rotationLabel}
        </div>
        {completions && (
          <div className="completion-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(completions.completedCount / completions.totalParticipants) * 100}%` }}
              />
            </div>
            <div className="progress-text">
              {completions.completedCount} / {completions.totalParticipants} أنهوا أجزاءهم
            </div>
          </div>
        )}
      </div>

      {completions?.allCompleted && (
        <div className="khatma-complete-banner">
          تمت الختمة بحمد الله
          <div className="complete-sub">أنهى جميع المشاركين أجزاءهم لهذه الدورة</div>
        </div>
      )}

      {data.paused && (
        <div className="paused-banner">
          الختمة متوقفة مؤقتاً
          <div className="paused-dates">
            من {new Date(data.khatma.paused_from).toLocaleDateString('ar-EG')} إلى {new Date(data.khatma.paused_to).toLocaleDateString('ar-EG')}
          </div>
        </div>
      )}

      <DeceasedInfo dedication={data.dedication} useHijri={data.khatma.use_hijri} />

      {!data.paused && (
        <div className="card">
          <h3 className="card-title">توزيع الأجزاء</h3>
          <div className="juz-grid">
            {Array.from({ length: 30 }, (_, i) => i + 1).map(juzNum => {
              const participant = data.participants.find(p => p.currentJuz === juzNum);
              const completed = participant && isCompleted(participant._id);
              const isMyJuz = myAssignment?.currentJuz === juzNum;

              return (
                <div key={juzNum} className={`juz-card ${isMyJuz ? 'highlighted' : ''} ${completed ? 'completed' : ''}`}>
                  <div className="juz-number">{juzNum}</div>
                  <div className="participant-name">
                    {participant ? participant.name : 'شاغر'}
                  </div>
                  <a
                    href={`https://quran.com/juz/${juzNum}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="read-juz-btn"
                  >
                    اقرأ الجزء
                  </a>
                  {participant && completed && (
                    <div className="completion-badge">تم</div>
                  )}
                  {participant && !completed && (
                    <button
                      className="btn-complete"
                      onClick={() => handleMarkComplete(participant._id)}
                    >
                      أنهيت
                    </button>
                  )}
                  {participant && completed && (
                    <button
                      className="btn-undo-complete"
                      onClick={() => handleUndoComplete(participant._id)}
                    >
                      تراجع
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="dashboard-actions no-print">
        <button className="btn btn-secondary" onClick={() => window.print()}>
          طباعة
        </button>
        <button className="btn btn-primary" onClick={handleWhatsAppShare}>
          مشاركة عبر واتساب
        </button>
        <button className="btn btn-secondary" onClick={handleLogout}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

export default Dashboard;
