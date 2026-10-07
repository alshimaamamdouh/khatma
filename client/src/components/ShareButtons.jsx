import { whatsappUrl, familyMessage, manageMessage } from '../utils/links';

function ShareButtons({ name, code, password }) {
  return (
    <div>
      <a className="btn btn-big btn-whatsapp" href={whatsappUrl(familyMessage(name, code))} target="_blank" rel="noopener noreferrer">
        🟢 أرسل الختمة للعائلة على واتساب
      </a>
      {password && (
        <>
          <a className="btn btn-big btn-secondary" href={whatsappUrl(manageMessage(name, code, password))} target="_blank" rel="noopener noreferrer">
            🔒 احفظ رابط الإدارة عندك على واتساب
          </a>
          <p className="hint">أرسل رابط الإدارة لنفسك فقط، واحتفظ بالرسالة.</p>
        </>
      )}
    </div>
  );
}

export default ShareButtons;
