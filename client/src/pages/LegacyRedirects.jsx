import { Navigate, useParams } from 'react-router-dom';
import { getKhatma, getActive } from '../utils/storage';
import { khatmaPath } from '../utils/links';

// Old bookmarks: /khatma/:id/dashboard, /khatma/:id/history, ...
export function LegacyKhatmaRedirect() {
  const { id } = useParams();
  const record = getKhatma(id);
  return <Navigate to={record?.code ? khatmaPath(record.code) : '/'} replace />;
}

// Old /admin/manage
export function LegacyManageRedirect() {
  const active = getActive();
  const to = active?.code && active.adminPassword ? `${khatmaPath(active.code)}/manage` : '/manage-login';
  return <Navigate to={to} replace />;
}
