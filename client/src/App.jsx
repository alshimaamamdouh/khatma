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
import KhatmaPage from './pages/KhatmaPage';
import ManageEntry from './pages/ManageEntry';
import LegacyLogin from './pages/LegacyLogin';
import ManageLayout from './pages/manage/ManageLayout';
import ManageMenu from './pages/manage/ManageMenu';
import NamesScreen from './pages/manage/NamesScreen';
import DeceasedScreen from './pages/manage/DeceasedScreen';
import FinishedScreen from './pages/manage/FinishedScreen';
import SendScreen from './pages/manage/SendScreen';
import PauseScreen from './pages/manage/PauseScreen';
import SettingsScreen from './pages/manage/SettingsScreen';
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
          <Route path="/k/:code" element={<KhatmaPage />} />
          <Route path="/m/:code" element={<ManageEntry />} />
          <Route path="/manage-login" element={<LegacyLogin />} />
          <Route path="/k/:code/manage" element={<ManageLayout />}>
            <Route index element={<ManageMenu />} />
            <Route path="names" element={<NamesScreen />} />
            <Route path="deceased" element={<DeceasedScreen />} />
            <Route path="finished" element={<FinishedScreen />} />
            <Route path="send" element={<SendScreen />} />
            <Route path="pause" element={<PauseScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="stats" element={<StatsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
