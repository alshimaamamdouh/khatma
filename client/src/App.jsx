import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import CreateKhatma from './pages/CreateKhatma';
import KhatmaPage from './pages/KhatmaPage';
import ManageEntry from './pages/ManageEntry';
import LegacyLogin from './pages/LegacyLogin';
import { LegacyKhatmaRedirect, LegacyManageRedirect } from './pages/LegacyRedirects';
import ManageLayout from './pages/manage/ManageLayout';
import ManageMenu from './pages/manage/ManageMenu';
import NamesScreen from './pages/manage/NamesScreen';
import DeceasedScreen from './pages/manage/DeceasedScreen';
import FinishedScreen from './pages/manage/FinishedScreen';
import SendScreen from './pages/manage/SendScreen';
import PauseScreen from './pages/manage/PauseScreen';
import SettingsScreen from './pages/manage/SettingsScreen';
import HistoryPage from './pages/HistoryPage';
import StatsPage from './pages/StatsPage';
import NotFound from './pages/NotFound';

function App() {
  return (
    <div className="app">
      <Header />
      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateKhatma />} />
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

          {/* Old addresses from before the redesign */}
          <Route path="/admin" element={<Navigate to="/create" replace />} />
          <Route path="/admin/create" element={<Navigate to="/create" replace />} />
          <Route path="/admin/manage" element={<LegacyManageRedirect />} />
          <Route path="/khatma/:id/*" element={<LegacyKhatmaRedirect />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
