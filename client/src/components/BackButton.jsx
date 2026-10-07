import { Link } from 'react-router-dom';

function BackButton({ to, label = 'رجوع' }) {
  return (
    <Link to={to} className="btn btn-big btn-secondary back-button">
      {label}
    </Link>
  );
}

export default BackButton;
