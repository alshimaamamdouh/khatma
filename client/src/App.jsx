import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SelectParticipant from './pages/SelectParticipant';
import Dashboard from './pages/Dashboard';
import AdminPage from './pages/AdminPage';
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
          <Route path="/khatma/:id/select" element={<SelectParticipant />} />
          <Route path="/khatma/:id/dashboard" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
