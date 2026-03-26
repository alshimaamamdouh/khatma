import { Link } from 'react-router-dom';

function Header() {
  return (
    <header className="header">
      <h1>ختمة القرآن الكريم</h1>
      <p>تنظيم ختم القرآن الكريم جماعياً</p>
      <nav className="header-nav">
        <Link to="/">الرئيسية</Link>
        <Link to="/admin">إنشاء ختمة جديدة</Link>
      </nav>
    </header>
  );
}

export default Header;
