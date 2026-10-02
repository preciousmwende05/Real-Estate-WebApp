import { Link } from 'react-router-dom';
import { EmptyState } from '../components/UI';

export default function NotFound() {
  return (
    <div className="container page">
      <EmptyState icon="home" title="Page not found" action={<Link to="/" className="btn btn-navy">Go home</Link>}>
        The page you're looking for doesn't exist.
      </EmptyState>
    </div>
  );
}
