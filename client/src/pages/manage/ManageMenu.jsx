import { Link, useOutletContext } from 'react-router-dom';
import { khatmaPath } from '../../utils/links';

const TILES = [
  { to: 'names', icon: '👥', label: 'الأسماء', quick: true },
  { to: 'deceased', icon: '🤲', label: 'الإهداء للمتوفين', quick: false },
  { to: 'finished', icon: '✅', label: 'تسجيل من أنهى القراءة', quick: true },
  { to: 'send', icon: '📤', label: 'إرسال للعائلة', quick: true },
  { to: 'pause', icon: '⏸️', label: 'إيقاف مؤقت', quick: false },
  { to: 'settings', icon: '⚙️', label: 'الإعدادات', quick: true },
  { to: 'history', icon: '📊', label: 'السجل والإحصائيات', quick: false }
];

function ManageMenu() {
  const { khatma, code } = useOutletContext();
  const tiles = TILES.filter(t => !khatma.is_quick || t.quick);

  return (
    <div>
      <div className="tile-grid">
        {tiles.map(t => (
          <Link key={t.to} to={t.to} className="tile">
            <span className="tile-icon" aria-hidden="true">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>
      <Link to={khatmaPath(code)} className="link-button">عرض الختمة كما يراها المشاركون</Link>
    </div>
  );
}

export default ManageMenu;
