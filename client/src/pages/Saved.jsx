import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import PropertyCard from '../components/PropertyCard';
import { Alert, EmptyState, PageHeader, Spinner } from '../components/UI';

export default function Saved() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/api/favorites').then((r) => setItems(r.data)).catch((e) => setError(errMsg(e))); }, []);

  const remove = async (p) => {
    try {
      await api.delete(`/api/favorites/${p.id}`);
      setItems((list) => list.filter((x) => x.id !== p.id));
    } catch (e) { setError(errMsg(e)); }
  };

  return (
    <div className="container page">
      <PageHeader eyebrow="Shortlist" title="Saved homes" subtitle="Homes you've tapped the heart on." />
      <Alert onClose={() => setError('')}>{error}</Alert>
      {!items ? <Spinner /> : items.length === 0 ? (
        <EmptyState icon="heart" title="Nothing saved yet" action={<Link to="/browse" className="btn btn-gold">Browse homes</Link>}>
          Tap the heart on any listing to keep it here.
        </EmptyState>
      ) : (
        <div className="property-grid wide">
          {items.map((p) => <PropertyCard key={p.id} p={{ ...p, is_favorite: true }} onToggleFavorite={remove} />)}
        </div>
      )}
    </div>
  );
}
