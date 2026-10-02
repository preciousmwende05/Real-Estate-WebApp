import { Link } from 'react-router-dom';
import Icon from './Icon';
import PropertyImage from './PropertyImage';
import { priceLabel, cap } from '../utils/format';

export default function PropertyCard({ p, onToggleFavorite, footer }) {
  const amenities = (p.amenities || []).map((a) => (typeof a === 'string' ? a : a.name));
  return (
    <article className="card property-card">
      <Link to={`/properties/${p.id}`} className="pc-image">
        <PropertyImage src={p.image_url} alt={p.title} />
        <span className={`badge badge-${p.listing_type}`}>{p.listing_type === 'rent' ? 'For Rent' : 'For Sale'}</span>
        {p.status !== 'available' && <span className={`badge badge-status status-${p.status}`}>{cap(p.status)}</span>}
      </Link>
      {onToggleFavorite && (
        <button className={`fav-btn ${p.is_favorite ? 'active' : ''}`} onClick={() => onToggleFavorite(p)}
          aria-label={p.is_favorite ? 'Remove from saved' : 'Save property'}>
          <Icon name="heart" size={18} fill={p.is_favorite ? 'currentColor' : 'none'} />
        </button>
      )}
      <div className="pc-body">
        <div className="pc-price">{priceLabel(p)}</div>
        <Link to={`/properties/${p.id}`} className="pc-title">{p.title}</Link>
        <div className="pc-location"><Icon name="pin" size={14} />{p.location}{p.county ? `, ${p.county}` : ''}</div>
        <p className="pc-desc">{p.description}</p>
        <div className="pc-facts">
          <span><Icon name="bed" size={16} />{p.bedrooms} Bed</span>
          <span><Icon name="bath" size={16} />{p.bathrooms} Bath</span>
          {p.size_sqm && <span><Icon name="area" size={16} />{p.size_sqm} m²</span>}
          <span className="pc-type">{cap(p.property_type)}</span>
        </div>
        {amenities.length > 0 && (
          <div className="chips">
            {amenities.slice(0, 3).map((a) => <span key={a} className="chip">{a}</span>)}
            {amenities.length > 3 && <span className="chip chip-more">+{amenities.length - 3}</span>}
          </div>
        )}
        {footer}
      </div>
    </article>
  );
}
