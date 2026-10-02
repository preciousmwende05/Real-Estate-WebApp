import { useState } from 'react';
import Icon from './Icon';

/** Property photo with a branded fallback if the image is missing or fails to load. */
export default function PropertyImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`img-fallback ${className}`} role="img" aria-label={alt}>
        <Icon name="home" size={42} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />;
}
