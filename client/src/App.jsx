import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SelectParticipant from './pages/SelectParticipant';
import Dashboard from './pages/Dashboard';
import AdminPage from './pages/AdminPage';
import CreateKhatma from './pages/CreateKhatma';
import ManageKhatma from './pages/ManageKhatma';
import HistoryPage from './pages/HistoryPage';
import StatsPage from './pages/StatsPage';
import NotFound from './pages/NotFound';
import Header from './components/Header';

function App() {
  return (
    <div className="app">
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/create" element={<CreateKhatma />} />
          <Route path="/admin/manage" element={<ManageKhatma />} />
          <Route path="/khatma/:id/select" element={<SelectParticipant />} />
          <Route path="/khatma/:id/dashboard" element={<Dashboard />} />
          <Route path="/khatma/:id/history" element={<HistoryPage />} />
          <Route path="/khatma/:id/stats" element={<StatsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
