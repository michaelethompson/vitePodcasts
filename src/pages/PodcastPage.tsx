import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { ErrorBox, Loading } from '../components/Status';
import { isFinished, progressKey, useLibrary } from '../context/LibraryContext';
import { api } from '../lib/api';
import { formatClock, formatDate, formatLength } from '../lib/format';
import { useAsync } from '../lib/useAsync';

const PAGE = 20;

export default function PodcastPage() {
  const { id = '' } = useParams();
  const { data, error, loading, retry } = useAsync(() => api.podcast(id), [id]);
  const { isFavorite, toggleFavorite, progress } = useLibrary();
  const [shown, setShown] = useState(PAGE);

  return (
    <>
      <Link to="/" className="btn back">
        <span aria-hidden="true">←</span> Back to Library
      </Link>
      {loading && !data && <Loading what="Loading episodes" />}
      {error && <ErrorBox message={error} onRetry={retry} />}
      {data && (
        <>
          <header className="podcast-head">
            {data.image && <img src={data.image} alt="" className="cover cover-large" />}
            <div>
              <PageHeading title={data.title}>{data.title}</PageHeading>
              <p className="muted">Subject: {data.subject}</p>
              {data.description && <p>{data.description}</p>}
              <button
                type="button"
                className="btn"
                aria-pressed={isFavorite(data.id)}
                onClick={() => toggleFavorite(data.id)}
              >
                <span aria-hidden="true">{isFavorite(data.id) ? '★' : '☆'}</span>{' '}
                {isFavorite(data.id) ? 'Favorite' : 'Add to favorites'}
              </button>
            </div>
          </header>

          <section aria-labelledby="eps-h">
            <h2 id="eps-h">Episodes, newest first</h2>
            {data.episodes.length === 0 && <p>This podcast has no episodes.</p>}
            <ol className="episodes">
              {data.episodes.slice(0, shown).map((ep) => {
                const p = progress[progressKey(data.id, ep.id)];
                const status = !p ? '' : isFinished(p) ? 'Played' : p.position > 10 ? `Resume at ${formatClock(p.position)}` : '';
                return (
                  <li key={ep.id}>
                    <Link
                      className="episode"
                      to={`/podcast/${encodeURIComponent(data.id)}/episode/${encodeURIComponent(ep.id)}`}
                    >
                      <span className="episode-title">{ep.title}</span>
                      <span className="muted">
                        {formatDate(ep.date, true)}
                        {ep.duration ? ` · ${formatLength(ep.duration)}` : ''}
                        {status ? ` · ${status}` : ''}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            {shown < data.episodes.length && (
              <button type="button" className="btn btn-primary btn-block" onClick={() => setShown((n) => n + PAGE)}>
                Show more episodes ({data.episodes.length - shown} remaining)
              </button>
            )}
          </section>
        </>
      )}
    </>
  );
}
