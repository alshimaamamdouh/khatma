import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { getJuzName } from '../utils/juzNames';
import KhatmaGrid from '../components/KhatmaGrid';
import DeceasedInfo from '../components/DeceasedInfo';

function Dashboard() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const participantId = localStorage.getItem('participantId');
  const participantName = localStorage.getItem('participantName');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const result = await api.getDashboard(id);
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [id]);

  if (loading) return <div className="loading">جاري التحميل...</div>;
  if (error) return <div className="error-msg">{error}</div>;
  if (!data) return null;

  const myAssignment = participantId
    ? data.participants.find(p => p.id === Number(participantId))
    : null;

  return (
    <div>
      <div className="card">
        <h2 className="card-title">{data.khatma.name}</h2>
        <div className="week-info">
          الأسبوع <strong>{data.weekNumber}</strong>
        </div>
      </div>

      <DeceasedInfo dedication={data.dedication} />

      {myAssignment && (
        <div className="card big-juz">
          <div className="juz-label">
            {participantName}، جزؤك لهذا الأسبوع هو
          </div>
          <div className="juz-name">{getJuzName(myAssignment.currentJuz)}</div>
          <div className="juz-num">الجزء رقم {myAssignment.currentJuz}</div>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">توزيع الأجزاء</h3>
        <KhatmaGrid
          participants={data.participants}
          highlightJuz={myAssignment?.currentJuz}
        />
      </div>
    </div>
  );
}

export default Dashboard;
