import { useNavigate } from 'react-router-dom';

function AdminPage() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <h2 className="card-title">لوحة الإدارة</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/admin/create')}>
            إنشاء ختمة جديدة
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => navigate('/admin/manage')}>
            إدارة ختمة موجودة
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
