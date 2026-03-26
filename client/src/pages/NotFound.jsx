import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="home-page">
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <h2 className="card-title">الصفحة غير موجودة</h2>
        <p style={{ marginBottom: 16 }}>الصفحة التي تبحث عنها غير موجودة</p>
        <Link to="/" className="btn btn-primary">العودة للرئيسية</Link>
      </div>
    </div>
  );
}

export default NotFound;
