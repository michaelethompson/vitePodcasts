import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { PodcastSummary } from '../../shared/types';
import { PageHeading } from '../components/PageHeading';
import { PodcastCard } from '../components/PodcastCard';
import { ErrorBox, Loading, Segmented } from '../components/Status';
import { isFinished, useLibrary } from '../context/LibraryContext';
import { useSettings } from '../context/SettingsContext';
import { api } from '../lib/api';
import { formatClock } from '../lib/format';
import { useAsync } from '../lib/useAsync';

const byName = (a: PodcastSummary, b: PodcastSummary) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
const byUpdated = (a: PodcastSummary, b: PodcastSummary) =>
  (b.lastUpdated ?? '').localeCompare(a.lastUpdated ?? '') || byName(a, b);

export default function Home() {
  const { grouping, sort, setGrouping, setSort } = useSettings();
  const { favorites, progress } = useLibrary();
  const { data, error, loading, retry } = useAsync(api.podcasts, []);

  const sorted = useMemo(() => [...(data ?? [])].sort(sort === 'name' ? byName : byUpdated), [data, sort]);
  const groups = useMemo(() => {
    const m = new Map<string, PodcastSummary[]>();
    for (const p of sorted) m.set(p.subject, [...(m.get(p.subject) ?? []), p]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sorted]);
  const favs = sorted.filter((p) => favorites.includes(p.id));
  const resume = Object.values(progress)
    .filter((p) => p.position > 10 && !isFinished(p) && data?.some((d) => d.id === p.podcastId))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);

  return (
    <>
      <PageHeading title="Library">Podcast Library</PageHeading>

      {resume.length > 0 && (
        <section aria-labelledby="continue-h" className="section">
          <h2 id="continue-h">Continue listening</h2>
          <ul className="resume-list">
            {resume.map((p) => (
              <li key={`${p.podcastId}/${p.episodeId}`}>
                <Link
                  className="btn btn-primary btn-block resume"
                  to={`/podcast/${encodeURIComponent(p.podcastId)}/episode/${encodeURIComponent(p.episodeId)}`}
                >
                  <strong>{p.title}</strong>
                  <span>
                    {p.podcastTitle} · Resume at {formatClock(p.position)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Display options" className="controls">
        <Segmented
          legend="Show podcasts"
          name="grouping"
          value={grouping}
          onChange={setGrouping}
          options={[
            { value: 'all', label: 'All together' },
            { value: 'subject', label: 'By subject' },
          ]}
        />
        <Segmented
          legend="Sort by"
          name="sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'name', label: 'Name (A–Z)' },
            { value: 'updated', label: 'Recently updated' },
          ]}
        />
      </section>
      <p className="view-state" aria-live="polite">
        Showing: {grouping === 'subject' ? 'grouped by subject' : 'all together'}, sorted by{' '}
        {sort === 'name' ? 'name' : 'most recently updated'}.
      </p>

      {loading && !data && <Loading what="Loading your podcasts" />}
      {error && <ErrorBox message={error} onRetry={retry} />}
      {data?.length === 0 && <p>There are no podcasts in the library yet.</p>}

      {favs.length > 0 && (
        <section aria-labelledby="fav-h" className="section">
          <h2 id="fav-h">My favorites</h2>
          <div className="grid">{favs.map((p) => <PodcastCard key={p.id} podcast={p} />)}</div>
        </section>
      )}

      {grouping === 'subject' ? (
        groups.map(([subject, list]) => (
          <section key={subject} aria-labelledby={`s-${subject}`} className="section">
            <h2 id={`s-${subject}`}>{subject}</h2>
            <div className="grid">{list.map((p) => <PodcastCard key={p.id} podcast={p} />)}</div>
          </section>
        ))
      ) : (
        <section aria-labelledby="all-h" className="section">
          <h2 id="all-h">All podcasts</h2>
          <div className="grid">{sorted.map((p) => <PodcastCard key={p.id} podcast={p} />)}</div>
        </section>
      )}
    </>
  );
}
