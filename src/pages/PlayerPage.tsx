import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { ErrorBox, Loading, Segmented } from '../components/Status';
import { usePlayer } from '../context/PlayerContext';
import { api } from '../lib/api';
import { formatClock, formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';

const RATES = [
  { value: 0.75, label: 'Slow' },
  { value: 1, label: 'Normal' },
  { value: 1.25, label: 'Fast' },
  { value: 1.5, label: 'Faster' },
];
const SLEEP = [
  { value: 0, label: 'Off' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' },
];

function spoken(seconds: number) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [h && `${h} hours`, m && `${m} minutes`, `${s % 60} seconds`].filter(Boolean).join(' ');
}

export default function PlayerPage() {
  const { id = '', episodeId = '' } = useParams();
  const { data, error, loading, retry } = useAsync(() => api.podcast(id), [id]);
  const p = usePlayer();

  const index = data?.episodes.findIndex((e) => e.id === episodeId) ?? -1;
  const episode = data && index >= 0 ? data.episodes[index] : undefined;
  const newer = data && index > 0 ? data.episodes[index - 1] : undefined;
  const older = data && index >= 0 ? data.episodes[index + 1] : undefined;

  useEffect(() => {
    if (data && episode) p.load({ podcastId: data.id, podcastTitle: data.title, image: data.image, episode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, episode?.id]);

  const active = !!episode && p.current?.episode.id === episode.id && p.current.podcastId === id;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!p.sleepEndsAt) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    setNow(Date.now());
    return () => clearInterval(t);
  }, [p.sleepEndsAt]);
  const sleepLeft = p.sleepEndsAt ? Math.max(1, Math.ceil((p.sleepEndsAt - now) / 60000)) : 0;

  const [transcript, setTranscript] = useState<{ open: boolean; loading: boolean; error?: string; paragraphs?: string[] }>({
    open: false,
    loading: false,
  });
  useEffect(() => setTranscript({ open: false, loading: false }), [episodeId]);

  async function toggleTranscript() {
    if (transcript.open) return setTranscript((t) => ({ ...t, open: false }));
    setTranscript((t) => ({ ...t, open: true }));
    if (transcript.paragraphs) return;
    setTranscript((t) => ({ ...t, loading: true, error: undefined }));
    try {
      const r = await api.transcript(id, episodeId);
      setTranscript({ open: true, loading: false, paragraphs: r.paragraphs });
    } catch (e) {
      setTranscript({ open: true, loading: false, error: (e as Error).message });
    }
  }

  const dur = active && p.duration ? p.duration : (episode?.duration ?? 0);
  const time = active ? p.time : 0;

  return (
    <>
      <Link to={`/podcast/${encodeURIComponent(id)}`} className="btn back">
        <span aria-hidden="true">←</span> Back to episodes
      </Link>
      {loading && !data && <Loading what="Loading the player" />}
      {error && <ErrorBox message={error} onRetry={retry} />}
      {data && !episode && (
        <>
          <PageHeading title="Episode not found">Episode not found</PageHeading>
          <p>We could not find that episode. It may have been removed by the publisher.</p>
        </>
      )}

      {data && episode && (
        <div className="player">
          <div className="player-art">
            {(episode.image ?? data.image) && <img src={episode.image ?? data.image} alt="" className="cover cover-large" />}
          </div>
          <div className="player-main">
            <p className="muted">{data.title}</p>
            <PageHeading title={episode.title}>{episode.title}</PageHeading>
            <p className="muted">{formatDate(episode.date, true)}</p>

            <div className="sr-only" role="status" aria-live="polite">
              {active && (p.playing ? `Playing: ${episode.title}` : 'Paused')}
            </div>
            {p.error && active && <ErrorBox message={p.error} />}

            <button type="button" className="btn btn-primary play" onClick={p.toggle} disabled={!active}>
              <span aria-hidden="true">{active && p.playing ? '⏸' : '▶'}</span>{' '}
              {active && p.playing ? 'Pause' : 'Play'}
            </button>
            {active && p.loading && p.playing && <p className="muted">Buffering…</p>}

            <div className="skip-row">
              <button type="button" className="btn" onClick={() => p.skip(-30)} disabled={!active}>
                <span aria-hidden="true">⏪</span> Back 30 seconds
              </button>
              <button type="button" className="btn" onClick={() => p.skip(30)} disabled={!active}>
                Forward 30 seconds <span aria-hidden="true">⏩</span>
              </button>
            </div>

            <div className="seek">
              <label htmlFor="seek">Position in episode</label>
              <input
                id="seek"
                type="range"
                min={0}
                max={Math.max(1, Math.floor(dur))}
                step={5}
                value={Math.min(Math.floor(time), Math.max(1, Math.floor(dur)))}
                disabled={!active || !dur}
                aria-valuetext={`${spoken(time)} of ${spoken(dur)}`}
                onChange={(e) => p.seekTo(Number(e.target.value))}
              />
              <div className="times" aria-hidden="true">
                <span>{formatClock(time)}</span>
                <span>-{formatClock(Math.max(0, dur - time))} left</span>
              </div>
            </div>

            <div className="skip-row">
              <Link
                className={`btn${newer ? '' : ' disabled'}`}
                aria-disabled={!newer}
                tabIndex={newer ? undefined : -1}
                to={newer ? `/podcast/${encodeURIComponent(id)}/episode/${encodeURIComponent(newer.id)}` : '#'}
                onClick={(e) => !newer && e.preventDefault()}
              >
                <span aria-hidden="true">⏮</span> Newer episode
              </Link>
              <Link
                className={`btn${older ? '' : ' disabled'}`}
                aria-disabled={!older}
                tabIndex={older ? undefined : -1}
                to={older ? `/podcast/${encodeURIComponent(id)}/episode/${encodeURIComponent(older.id)}` : '#'}
                onClick={(e) => !older && e.preventDefault()}
              >
                Older episode <span aria-hidden="true">⏭</span>
              </Link>
            </div>

            <Segmented legend="Speed" name="rate" value={p.rate} options={RATES} onChange={p.setRate} />

            <div className="seek">
              <label htmlFor="vol">
                Volume: {Math.round(p.volume * 100)}%
              </label>
              <input
                id="vol"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={p.volume}
                aria-valuetext={`${Math.round(p.volume * 100)} percent`}
                onChange={(e) => p.setVolume(Number(e.target.value))}
              />
              <p className="muted small">You can also use your device’s volume buttons.</p>
            </div>

            <Segmented
              legend="Sleep timer"
              name="sleep"
              value={p.sleepMinutes ?? 0}
              options={SLEEP}
              onChange={(v) => p.setSleep(v || null)}
            />
            {p.sleepEndsAt && <p className="muted">Playback will stop in about {sleepLeft} minutes.</p>}

            {episode.description && (
              <section aria-labelledby="about-h" className="section">
                <h2 id="about-h">About this episode</h2>
                <p>{episode.description}</p>
              </section>
            )}

            {episode.transcriptUrl && (
              <section aria-labelledby="tr-h" className="section">
                <h2 id="tr-h">Transcript</h2>
                <button type="button" className="btn" aria-expanded={transcript.open} onClick={toggleTranscript}>
                  {transcript.open ? 'Hide transcript' : 'Read transcript'}
                </button>
                {transcript.open && transcript.loading && <Loading what="Loading the transcript" />}
                {transcript.open && transcript.error && (
                  <p role="alert">
                    {transcript.error}{' '}
                    <a href={episode.transcriptUrl} target="_blank" rel="noopener noreferrer">
                      Open the original transcript (opens in a new tab)
                    </a>
                  </p>
                )}
                {transcript.open && transcript.paragraphs && (
                  <div className="transcript">
                    {transcript.paragraphs.map((t, i) => (
                      <p key={i}>{t}</p>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
