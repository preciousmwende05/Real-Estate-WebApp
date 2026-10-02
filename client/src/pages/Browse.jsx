import { useEffect, useState, useCallback } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PropertyCard from '../components/PropertyCard';
import Icon from '../components/Icon';
import { Alert, EmptyState, PageHeader, Spinner } from '../components/UI';
import { kesShort, cap } from '../utils/format';

const EMPTY = { q: '', locations: [], types: [], bedrooms: '', min_price: '', max_price: '', amenities: [], sort: 'newest' };
const RENT_BUDGETS = [[0, 30000], [30000, 60000], [60000, 120000], [120000, 300000], [300000, '']];
const SALE_BUDGETS = [[0, 10e6], [10e6, 25e6], [25e6, 60e6], [60e6, 150e6], [150e6, '']];

export default function Browse() {
  const { user, meta } = useAuth();
  const isRenter = user.role === 'renter';
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const f = applied;
    const params = {
      q: f.q || undefined,
      locations: f.locations.join(',') || undefined,
      types: f.types.join(',') || undefined,
      amenities: f.amenities.join(',') || undefined,
      bedrooms: f.bedrooms || undefined,
      min_price: f.min_price || undefined,
      max_price: f.max_price || undefined,
      sort: f.sort,
      page,
    };
    try {
      const res = await api.get('/search/properties', { params });
      setData(res.data);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/search/insights').then((r) => setInsights(r.data)).catch(() => {}); }, []);

  const apply = (next = filters) => { setApplied(next); setPage(1); setShowFilters(false); };
  const reset = () => { setFilters(EMPTY); apply(EMPTY); };
  const toggle = (key, value) => setFilters((f) => ({
    ...f, [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
  }));

  const toggleFavorite = async (p) => {
    try {
      if (p.is_favorite) await api.delete(`/api/favorites/${p.id}`);
      else await api.post(`/api/favorites/${p.id}`);
      setData((d) => ({ ...d, results: d.results.map((x) => (x.id === p.id ? { ...x, is_favorite: !x.is_favorite } : x)) }));
    } catch (err) { setError(errMsg(err)); }
  };

  const interpreted = data?.interpreted || {};
  const locName = (id) => meta.locations.find((l) => l.id === id)?.name;
  const amenName = (id) => meta.amenities.find((a) => a.id === id)?.name;
  const budgets = isRenter ? RENT_BUDGETS : SALE_BUDGETS;

  return (
    <div className="container page">
      <PageHeader
        eyebrow={isRenter ? 'Rentals' : 'For sale'}
        title={isRenter ? 'Homes available to rent' : 'Homes available to buy'}
        subtitle={insights?.summary ? `${insights.summary.available} available · average ${isRenter ? 'rent' : 'price'} ${kesShort(insights.summary.avg_price)}${isRenter ? '/mo' : ''} · ${insights.summary.new_this_week || 0} new this week` : null}
      />

      {/* Smart search bar */}
      <form className="smart-search" onSubmit={(e) => { e.preventDefault(); apply(); }}>
        <Icon name="sparkle" size={20} className="gold" />
        <input
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          placeholder={isRenter ? 'Try “2 bedroom apartment in Kilimani under 60k with parking”' : 'Try “4 bedroom mansion in Karen with pool under 150m”'}
          aria-label="Smart search"
        />
        <button type="button" className="btn btn-outline btn-sm filter-toggle" onClick={() => setShowFilters(!showFilters)}>
          <Icon name="filter" size={16} /> Filters
        </button>
        <button className="btn btn-gold">Search</button>
      </form>

      {Object.keys(interpreted).length > 0 && (
        <div className="interpreted">
          <span className="muted">Understood as:</span>
          {interpreted.bedrooms && <span className="chip chip-gold">{interpreted.bedrooms} bedrooms</span>}
          {interpreted.property_types?.map((t) => <span key={t} className="chip chip-gold">{cap(t)}</span>)}
          {interpreted.location_ids?.map((id) => <span key={id} className="chip chip-gold">{locName(id)}</span>)}
          {interpreted.min_price && <span className="chip chip-gold">from {kesShort(interpreted.min_price)}</span>}
          {interpreted.max_price && <span className="chip chip-gold">up to {kesShort(interpreted.max_price)}</span>}
          {interpreted.amenity_ids?.map((id) => <span key={id} className="chip chip-gold">{amenName(id)}</span>)}
          {data?.keyword && <span className="chip">“{data.keyword}”</span>}
        </div>
      )}

      <div className="browse-layout">
        <aside className={`filters card ${showFilters ? 'open' : ''}`}>
          <div className="filters-head">
            <h3>Filters</h3>
            <button className="link-btn" onClick={reset}>Reset</button>
          </div>

          <div className="filter-group">
            <label className="filter-label">Location</label>
            <select multiple size={6} value={filters.locations.map(String)}
              onChange={(e) => setFilters({ ...filters, locations: [...e.target.selectedOptions].map((o) => Number(o.value)) })}>
              {['Nairobi', 'Kiambu', 'Kajiado', 'Machakos'].map((county) => (
                <optgroup key={county} label={county}>
                  {meta.locations.filter((l) => l.county === county).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </optgroup>
              ))}
            </select>
            <small className="hint">Ctrl/⌘-click to choose several</small>
          </div>

          <div className="filter-group">
            <label className="filter-label">Property type</label>
            <div className="chips">
              {meta.property_types.map((t) => (
                <button key={t} type="button" className={`chip chip-btn ${filters.types.includes(t) ? 'on' : ''}`} onClick={() => toggle('types', t)}>{cap(t)}</button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Bedrooms</label>
            <div className="segmented">
              {['', 1, 2, 3, 4, 5].map((b) => (
                <button key={b} type="button" className={String(filters.bedrooms) === String(b) ? 'on' : ''}
                  onClick={() => setFilters({ ...filters, bedrooms: b })}>{b || 'Any'}</button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">{isRenter ? 'Monthly rent (KES)' : 'Price (KES)'}</label>
            <div className="chips">
              {budgets.map(([lo, hi]) => (
                <button key={lo} type="button"
                  className={`chip chip-btn ${String(filters.min_price) === String(lo || '') && String(filters.max_price) === String(hi) ? 'on' : ''}`}
                  onClick={() => setFilters({ ...filters, min_price: lo || '', max_price: hi })}>
                  {hi ? `${lo ? kesShort(lo).replace('KES ', '') + '–' : 'Under '}${kesShort(hi).replace('KES ', '')}` : `${kesShort(lo).replace('KES ', '')}+`}
                </button>
              ))}
            </div>
            <div className="range-row">
              <input type="number" min="0" placeholder="Min" value={filters.min_price} onChange={(e) => setFilters({ ...filters, min_price: e.target.value })} />
              <span>–</span>
              <input type="number" min="0" placeholder="Max" value={filters.max_price} onChange={(e) => setFilters({ ...filters, max_price: e.target.value })} />
            </div>
          </div>

          <div className="filter-group">
            <label className="filter-label">Amenities</label>
            <div className="checkbox-list">
              {meta.amenities.map((a) => (
                <label key={a.id} className="check">
                  <input type="checkbox" checked={filters.amenities.includes(a.id)} onChange={() => toggle('amenities', a.id)} />
                  {a.name}
                </label>
              ))}
            </div>
          </div>

          <button className="btn btn-navy btn-block" onClick={() => apply()}>Show results</button>
        </aside>

        <section>
          <div className="results-bar">
            <span className="muted">{data ? `${data.total} ${data.total === 1 ? 'home' : 'homes'} found` : ' '}</span>
            <select value={applied.sort} onChange={(e) => { const n = { ...filters, sort: e.target.value }; setFilters(n); apply(n); }} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="popular">Most viewed</option>
              <option value="bedrooms">Most bedrooms</option>
            </select>
          </div>
          <Alert onClose={() => setError('')}>{error}</Alert>
          {loading ? <Spinner /> : data?.results?.length ? (
            <>
              <div className="property-grid">
                {data.results.map((p) => <PropertyCard key={p.id} p={p} onToggleFavorite={toggleFavorite} />)}
              </div>
              {data.pages > 1 && (
                <div className="pagination">
                  <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                  <span>Page {page} of {data.pages}</span>
                  <button className="btn btn-outline btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next →</button>
                </div>
              )}
            </>
          ) : (
            <EmptyState icon="search" title="No homes match your search" action={<button className="btn btn-outline" onClick={reset}>Clear filters</button>}>
              Try widening your budget, removing an amenity or picking a nearby area.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
