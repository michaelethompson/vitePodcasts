import { Link } from 'react-router-dom';
import type { PodcastSummary } from '../../shared/types';
import { useLibrary } from '../context/LibraryContext';
import { formatDate } from '../lib/format';

export function PodcastCard({ podcast }: { podcast: PodcastSummary }) {
  const { isFavorite, toggleFavorite } = useLibrary();
  const fav = isFavorite(podcast.id);
  return (
    <article className="card">
      <Link to={`/podcast/${encodeURIComponent(podcast.id)}`} className="card-link">
        {podcast.image ? (
          <img src={podcast.image} alt="" loading="lazy" className="cover" />
        ) : (
          <div className="cover cover-empty" aria-hidden="true">🎙</div>
        )}
        <div className="card-text">
          <h3>{podcast.title}</h3>
          <p className="muted">
            {podcast.error ? 'Currently unavailable' : `Updated: ${formatDate(podcast.lastUpdated)}`}
          </p>
        </div>
      </Link>
      <button
        type="button"
        className="btn btn-block"
        aria-pressed={fav}
        onClick={() => toggleFavorite(podcast.id)}
      >
        <span aria-hidden="true">{fav ? '★' : '☆'}</span> {fav ? 'Favorite' : 'Add to favorites'}
        <span className="sr-only"> {podcast.title}</span>
      </button>
    </article>
  );
}
