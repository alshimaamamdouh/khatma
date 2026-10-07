import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { saveKhatma, setActive, getKhatma, forgetParticipant } from '../utils/storage';
import { khatmaPath, whatsappUrl } from '../utils/links';
import { ar } from '../utils/arabicNumbers';
import { formatDate } from '../utils/hijriDate';
import WhoAreYou from '../components/WhoAreYou';
import QuickJuzPicker from '../components/QuickJuzPicker';
import MyJuzCard from '../components/MyJuzCard';
import ParticipantsList from '../components/ParticipantsList';
import DedicationLine from '../components/DedicationLine';
import DuaKhatm from '../components/DuaKhatm';

function KhatmaPage() {
  const { code } = useParams();
  const [khatmaId, setKhatmaId] = useState(null);
  const [data, setData] = useState(null);
  const [completions, setCompletions] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (id) => {
    const dash = await api.getDashboard(id);
    const comp = await api.getCompletions(id, dash.cycleNumber);
    setData(dash);
    setCompletions(comp);
    return dash;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const access = await api.access(code);
        const id = access.khatma._id;
        saveKhatma(id, { code, name: access.khatma.name });
        setActive(id);
        const dash = await load(id);
        if (cancelled) return;
        setKhatmaId(id);
        const saved = getKhatma(id);
        const stillListed = dash.participants.some(p => p._id === saved?.participantId);
        if (saved?.participantToken && stillListed) {
          setMe(saved.participantId);
        } else {
          forgetParticipant(id);
          setMe(null);
        }
      } catch (err) {
        // A wrong link returns 404 "رمز الختمة غير صحيح" — don't show technical words to participants
        if (!cancelled) setError(err.status === 404 ? 'لم نجد هذه الختمة.' : err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code, load]);

  const handleClaimed = (participantId, token) => {
    saveKhatma(khatmaId, { participantId, participantToken: token });
    setMe(participantId);
  };

  const handleJoined = async (participantId, token) => {
    saveKhatma(khatmaId, { participantId, participantToken: token });
    setMe(participantId);
    try { await load(khatmaId); } catch { /* joined already; keep the page we have */ }
  };

  const handleChangeName = () => {
    forgetParticipant(khatmaId);
    setMe(null);
  };

  const refreshCompletions = async () => {
    setCompletions(await api.getCompletions(khatmaId, data.cycleNumber));
  };

  if (loading) return <div className="loading">جاري التحميل...</div>;

  if (error) {
    return (
      <div className="card center-text">
        <p className="big-text">{error}</p>
        <p className="big-text">تأكد من الرابط، أو اسأل منظم الختمة.</p>
        <Link to="/" className="btn btn-big btn-secondary">الصفحة الرئيسية</Link>
      </div>
    );
  }

  const { khatma } = data;
  const isQuick = khatma.is_quick;
  const isOrganizer = !!getKhatma(khatmaId)?.adminPassword;
  const myself = data.participants.find(p => p._id === me);
  const isDone = (pid) => !!completions?.completedIds?.includes(pid);
  const juzOf = (p) => (isQuick ? p.slot_number : p.currentJuz);
  const allDone = completions?.allCompleted && completions.totalParticipants > 0;

  return (
    <div>
      <h2 className="khatma-title">{khatma.name}</h2>

      {isOrganizer && (
        <Link to={`${khatmaPath(code)}/manage`} className="btn btn-big btn-secondary">
          ⚙️ إدارة الختمة
        </Link>
      )}

      {allDone && (
        <>
          <div className="khatma-complete-banner">
            🎉 تمت الختمة بحمد الله
            <div className="complete-sub">أنهى جميع المشاركين قراءتهم</div>
          </div>
          <DuaKhatm />
        </>
      )}

      {data.paused ? (
        <div className="paused-banner">
          ⏸️ الختمة متوقفة مؤقتًا حتى {formatDate(khatma.paused_to, khatma.use_hijri)}
        </div>
      ) : myself ? (
        <MyJuzCard
          khatmaId={khatmaId}
          participant={myself}
          juz={juzOf(myself)}
          cycleNumber={data.cycleNumber}
          done={isDone(myself._id)}
          nextChangeDate={data.nextChangeDate}
          useHijri={khatma.use_hijri}
          onChanged={refreshCompletions}
        />
      ) : isQuick ? (
        <QuickJuzPicker
          khatmaId={khatmaId}
          participants={data.participants}
          isDone={isDone}
          onJoined={handleJoined}
          onRefresh={() => load(khatmaId)}
        />
      ) : (
        <WhoAreYou khatmaId={khatmaId} participants={data.participants} onClaimed={handleClaimed} />
      )}

      {!isQuick && <DedicationLine dedication={data.dedication} />}

      {myself && completions && completions.totalParticipants > 0 && (
        <div className="progress-card">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(completions.completedCount / completions.totalParticipants) * 100}%` }}
            />
          </div>
          <p className="progress-sentence">
            {ar(completions.completedCount)} من {ar(completions.totalParticipants)} شخصًا أنهوا القراءة
          </p>
        </div>
      )}

      {myself && <ParticipantsList participants={data.participants} juzOf={juzOf} isDone={isDone} />}

      <div className="page-footer">
        {myself && (
          <button className="link-button" onClick={handleChangeName}>
            لست {myself.name.trim().split(/\s+/)[0]}؟ غيّر الاسم
          </button>
        )}
        {khatma.organizer_phone && (
          <a
            className="link-button"
            href={whatsappUrl(`السلام عليكم، أحتاج مساعدة في: ${khatma.name}`, khatma.organizer_phone)}
            target="_blank"
            rel="noopener noreferrer"
          >
            💬 تحتاج مساعدة؟ تواصل مع منظم الختمة
          </a>
        )}
      </div>
    </div>
  );
}

export default KhatmaPage;
