import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

function SelectParticipant() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const data = await api.getParticipants(id);
        setParticipants(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchParticipants();
  }, [id]);

  const handleSelect = (participant) => {
    localStorage.setItem('participantId', participant.id);
    localStorage.setItem('participantName', participant.name);
    localStorage.setItem('participantSlot', participant.slot_number);
    navigate(`/khatma/${id}/dashboard`);
  };

  const handleViewAll = () => {
    localStorage.removeItem('participantId');
    localStorage.removeItem('participantName');
    localStorage.removeItem('participantSlot');
    navigate(`/khatma/${id}/dashboard`);
  };

  if (loading) return <div className="loading">جاري التحميل...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  return (
    <div>
      <div className="card">
        <h2 className="card-title">اختر اسمك</h2>
        <p style={{ textAlign: 'center', marginBottom: 16, color: 'var(--text-light)' }}>
          اختر اسمك من القائمة لعرض الجزء المخصص لك
        </p>

        <div className="participant-select-grid">
          {participants.map(p => (
            <div
              key={p.id}
              className="participant-select-card"
              onClick={() => handleSelect(p)}
            >
              <div className="slot-num">#{p.slot_number}</div>
              <div>{p.name}</div>
            </div>
          ))}
        </div>

        {participants.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: 20 }}>
            لا يوجد مشاركون حالياً
          </p>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={handleViewAll}>
          عرض الختمة كاملة بدون تحديد اسم
        </button>
      </div>
    </div>
  );
}

export default SelectParticipant;
