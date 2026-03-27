import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Header() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  return (
    <header className="header">
      <h1>ختمة القرآن الكريم</h1>
      <p>تنظيم ختم القرآن الكريم جماعياً</p>
      <nav className="header-nav">
        <Link to="/">الرئيسية</Link>
        <Link to="/admin">إنشاء ختمة جديدة</Link>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
        </button>
      </nav>
    </header>
  );
}

export default Header;
