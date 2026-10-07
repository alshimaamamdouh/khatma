import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Outlet } from 'react-router-dom';
import { api } from '../../api/client';
import { findIdByCode, getKhatma, setActive } from '../../utils/storage';

// Loads the organizer's data once and shares it with every manage screen
function ManageLayout() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', khatma: null, participants: [], deceased: [] });
  const id = findIdByCode(code);
  const password = id ? getKhatma(id)?.adminPassword : null;

  const reload = useCallback(async () => {
    try {
      const data = await api.adminLogin(code, password);
      setState({ loading: false, error: '', khatma: data.khatma, participants: data.participants, deceased: data.deceased });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [code, password]);

  useEffect(() => {
    if (!password) {
      navigate('/manage-login', { replace: true });
      return;
    }
    setActive(id);
    reload();
  }, [id, password, navigate, reload]);

  if (state.loading) return <div className="loading">جاري التحميل...</div>;
  if (state.error) return <div className="error-msg">{state.error}</div>;

  return (
    <div>
      <h2 className="khatma-title">إدارة: {state.khatma.name}</h2>
      <Outlet context={{ ...state, code, khatmaId: state.khatma._id, password, reload }} />
    </div>
  );
}

export default ManageLayout;
