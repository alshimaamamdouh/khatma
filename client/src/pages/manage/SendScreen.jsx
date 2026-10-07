import { useOutletContext } from 'react-router-dom';
import { whatsappUrl, reminderMessage, distributionMessage } from '../../utils/links';
import { ar } from '../../utils/arabicNumbers';
import { useCycleStatus } from './useCycleStatus';
import ShareButtons from '../../components/ShareButtons';
import BackButton from '../../components/BackButton';

function SendScreen() {
  const { khatma, khatmaId, code, password } = useOutletContext();
  const { dash, completions, loading, error } = useCycleStatus(khatmaId);

  if (loading) return <div className="loading">جاري التحميل...</div>;
  if (error) return <div className="error-msg">{error}</div>;

  const juzOf = (p) => (khatma.is_quick ? p.slot_number : p.currentJuz);
  const isDone = (pid) => completions.completedIds.includes(pid);
  const notDone = dash.participants.filter(p => !isDone(p._id)).map(p => ({ name: p.name, juz: juzOf(p) }));

  const distribution = distributionMessage({
    name: khatma.name,
    code,
    isQuick: khatma.is_quick,
    khatmaNumber: dash.currentKhatmaNumber,
    dedicatedNames: dash.dedication?.dedicated?.map(d => d.name) || [],
    rows: dash.participants.map(p => ({ juz: juzOf(p), name: p.name, done: isDone(p._id) })),
    completedCount: completions.completedCount,
    total: completions.totalParticipants
  });

  return (
    <div>
      <h3 className="section-title">إرسال للعائلة</h3>
      <ShareButtons name={khatma.name} code={code} password={password} />

      {notDone.length > 0 && !dash.paused && (
        <a className="btn btn-big btn-secondary" href={whatsappUrl(reminderMessage(khatma.name, code, notDone))} target="_blank" rel="noopener noreferrer">
          🔔 إرسال تذكير لمن لم ينته ({ar(notDone.length)})
        </a>
      )}

      <a className="btn btn-big btn-secondary" href={whatsappUrl(distribution)} target="_blank" rel="noopener noreferrer">
        📋 إرسال توزيع الأجزاء كاملًا
      </a>

      <BackButton to=".." />
    </div>
  );
}

export default SendScreen;
