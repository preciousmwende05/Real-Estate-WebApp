import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api, { errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/Icon';
import PropertyImage from '../../components/PropertyImage';
import { Alert, PageHeader, Spinner } from '../../components/UI';
import { cap, kes } from '../../utils/format';

const BLANK = { listing_type: 'sale', property_type: 'apartment', bedrooms: 2, bathrooms: 1, location_id: '', price: '', size_sqm: '', description: '', amenities: [] };

export default function ListingEditor() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { meta } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(BLANK);
  const [image, setImage] = useState(null);       // File chosen by the seller
  const [preview, setPreview] = useState(null);   // object URL or existing image_url
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;
    api.get(`/api/properties/${id}`).then(({ data }) => {
      setForm({
        listing_type: data.listing_type, property_type: data.property_type, bedrooms: data.bedrooms, bathrooms: data.bathrooms,
        location_id: data.location_id, price: data.price, size_sqm: data.size_sqm || '', description: data.description,
        amenities: data.amenities.map((a) => a.id),
      });
      setPreview(data.image_url);
    }).catch((e) => setError(errMsg(e))).finally(() => setLoading(false));
  }, [id, editing]);

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleAmenity = (aid) => setForm((f) => ({
    ...f, amenities: f.amenities.includes(aid) ? f.amenities.filter((x) => x !== aid) : [...f.amenities, aid],
  }));

  const pickImage = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Please choose a JPG, PNG or WEBP image');
    if (file.size > 5 * 1024 * 1024) return setError('Image must be 5 MB or smaller');
    setError('');
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const locationName = meta.locations.find((l) => String(l.id) === String(form.location_id))?.name;
  const titlePreview = `${form.bedrooms} Bedroom ${cap(form.property_type)} in ${locationName || '…'}`;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.location_id) return setError('Please choose a location');
    setSaving(true);
    setError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, Array.isArray(v) ? v.join(',') : v));
    if (image) fd.append('image', image);
    try {
      if (editing) await api.put(`/api/properties/${id}`, fd);
      else await api.post('/api/properties', fd);
      navigate('/seller');
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="container page narrow">
      <Link to="/seller" className="back-link">← My properties</Link>
      <PageHeader eyebrow={editing ? 'Edit listing' : 'New listing'} title={titlePreview}
        subtitle="The title is built automatically from bedrooms, property type and location." />
      <Alert onClose={() => setError('')}>{error}</Alert>

      <form className="card pad editor" onSubmit={submit}>
        <div className="editor-grid">
          <div>
            <label className="filter-label">Property photo</label>
            <label className={`upload-box ${preview ? 'has-image' : ''}`}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickImage(e.dataTransfer.files[0]); }}>
              {preview ? <PropertyImage src={preview} alt="Listing preview" /> : (
                <div className="upload-empty"><Icon name="upload" size={28} /><strong>Upload a photo</strong><small>JPG, PNG or WEBP · max 5 MB</small></div>
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickImage(e.target.files[0])} />
              {preview && <span className="upload-change"><Icon name="upload" size={14} /> Change photo</span>}
            </label>
            {!preview && <p className="hint">No photo? We'll use a placeholder illustration until you add one.</p>}
          </div>

          <div className="form-grid">
            <div className="field span-2">
              <span>Listing type</span>
              <div className="segmented big">
                <button type="button" className={form.listing_type === 'sale' ? 'on' : ''} onClick={() => setForm({ ...form, listing_type: 'sale' })}><Icon name="tag" size={16} /> For sale</button>
                <button type="button" className={form.listing_type === 'rent' ? 'on' : ''} onClick={() => setForm({ ...form, listing_type: 'rent' })}><Icon name="key" size={16} /> For rent</button>
              </div>
            </div>
            <label className="field">
              <span>Property type</span>
              <select value={form.property_type} onChange={set('property_type')}>
                {meta.property_types.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Location</span>
              <select value={form.location_id} onChange={set('location_id')} required>
                <option value="">Choose area…</option>
                {['Nairobi', 'Kiambu', 'Kajiado', 'Machakos'].map((c) => (
                  <optgroup key={c} label={`${c} County`}>
                    {meta.locations.filter((l) => l.county === c).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="field">
              <span>Bedrooms</span>
              <div className="segmented">
                {[1, 2, 3, 4, 5].map((b) => (
                  <button type="button" key={b} className={Number(form.bedrooms) === b ? 'on' : ''} onClick={() => setForm({ ...form, bedrooms: b })}>{b}</button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Bathrooms</span>
              <input type="number" min="1" max="8" value={form.bathrooms} onChange={set('bathrooms')} />
            </label>
            <label className="field">
              <span>{form.listing_type === 'rent' ? 'Monthly rent (KES)' : 'Selling price (KES)'}</span>
              <input type="number" min="1000" required value={form.price} onChange={set('price')} />
              {form.price && <small className="hint">{kes(form.price)}{form.listing_type === 'rent' ? ' per month' : ''}</small>}
            </label>
            <label className="field">
              <span>Size (m², optional)</span>
              <input type="number" min="10" value={form.size_sqm} onChange={set('size_sqm')} />
            </label>
          </div>
        </div>

        <label className="field">
          <span>Short description</span>
          <textarea rows={3} maxLength={600} required value={form.description} onChange={set('description')}
            placeholder="Highlight what makes this home special — finishes, views, neighbourhood, nearby schools…" />
          <small className="hint">{form.description.length}/600 · at least 20 characters</small>
        </label>

        <div className="field">
          <span>Amenities</span>
          <div className="chips">
            {meta.amenities.map((a) => (
              <button type="button" key={a.id} className={`chip chip-btn ${form.amenities.includes(a.id) ? 'on' : ''}`} onClick={() => toggleAmenity(a.id)}>
                {form.amenities.includes(a.id) && <Icon name="check" size={13} />} {a.name}
              </button>
            ))}
          </div>
        </div>

        <div className="editor-actions">
          <Link to="/seller" className="btn btn-outline">Cancel</Link>
          <button className="btn btn-gold" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}</button>
        </div>
      </form>
    </div>
  );
}
