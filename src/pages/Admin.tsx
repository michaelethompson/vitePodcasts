import { useEffect, useState, type FormEvent } from 'react';
import { PageHeading } from '../components/PageHeading';
import { ErrorBox, Loading } from '../components/Status';
import { api, getToken, setToken, type AccountSummary, type AdminPodcast, type FeedPreview } from '../lib/api';
import { formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setToken((await api.login(password)).token);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <div className="field">
        <label htmlFor="pw">Administrator password</label>
        <input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <ErrorBox message={error} />}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function PodcastForm({
  initial,
  subjects,
  onSaved,
  onCancel,
}: {
  initial?: AdminPodcast;
  subjects: string[];
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [feedUrl, setFeedUrl] = useState(initial?.feedUrl ?? '');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [preview, setPreview] = useState<FeedPreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = { feedUrl, subject, name: name || undefined };

  async function check() {
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      setPreview(await api.adminPreview(input));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (initial) await api.adminUpdate(initial.id, input);
      else await api.adminAdd(input);
      onSaved();
      if (!initial) {
        setFeedUrl('');
        setSubject('');
        setName('');
        setPreview(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const uid = initial?.id ?? 'new';
  return (
    <form onSubmit={save} className="form">
      <div className="field">
        <label htmlFor={`url-${uid}`}>Feed address (RSS link)</label>
        <input id={`url-${uid}`} type="url" value={feedUrl} onChange={(e) => { setFeedUrl(e.target.value); setPreview(null); }} required placeholder="https://example.com/feed.xml" />
      </div>
      <div className="field">
        <label htmlFor={`sub-${uid}`}>Subject</label>
        <input id={`sub-${uid}`} list={`subjects-${uid}`} value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={60} />
        <datalist id={`subjects-${uid}`}>{subjects.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      <div className="field">
        <label htmlFor={`name-${uid}`}>Display name (optional)</label>
        <input id={`name-${uid}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Leave empty to use the podcast’s own name" />
      </div>
      {error && <ErrorBox message={error} />}
      {preview && (
        <p role="status" className="preview">
          Found “{preview.title}” with {preview.episodeCount} episodes. Last updated {formatDate(preview.lastUpdated)}.
        </p>
      )}
      <div className="skip-row">
        <button type="button" className="btn" onClick={check} disabled={busy || !feedUrl}>
          Check feed
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {initial ? 'Save changes' : 'Add podcast'}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Accounts() {
  const { data, error, loading, retry } = useAsync(api.adminUsers, []);
  const [resetting, setResetting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');

  async function act(fn: () => Promise<unknown>, done: string) {
    setActionError('');
    try {
      await fn();
      setResetting(null);
      setConfirming(null);
      setPassword('');
      setMessage(done);
      retry();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  const reset = (u: AccountSummary) => (e: FormEvent) => {
    e.preventDefault();
    void act(() => api.adminSetUserPassword(u.id, password), `Password changed for ${u.username}.`);
  };

  return (
    <section aria-labelledby="acct-h" className="section">
      <h2 id="acct-h">Accounts</h2>
      <div role="status" className="sr-only">{message}</div>
      {message && <p className="preview">{message}</p>}
      {loading && !data && <Loading />}
      {error && <ErrorBox message={error} onRetry={retry} />}
      {actionError && <ErrorBox message={actionError} />}
      {data?.length === 0 && <p>Nobody has created an account yet.</p>}
      <ul className="admin-list">
        {data?.map((u) => (
          <li key={u.id} className="admin-item">
            <h3>{u.username}</h3>
            <p className="muted">Created {formatDate(u.createdAt)}</p>
            {resetting === u.id ? (
              <form onSubmit={reset(u)} className="form">
                <div className="field">
                  <label htmlFor={`np-${u.id}`}>New password for {u.username} (at least 8 characters)</label>
                  <input id={`np-${u.id}`} type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="off" />
                </div>
                <div className="skip-row">
                  <button type="submit" className="btn btn-primary">Set password</button>
                  <button type="button" className="btn" onClick={() => { setResetting(null); setPassword(''); }}>Cancel</button>
                </div>
              </form>
            ) : confirming === u.id ? (
              <div className="skip-row">
                <button type="button" className="btn btn-danger" onClick={() => act(() => api.adminDeleteUser(u.id), `Removed ${u.username}.`)}>
                  Yes, remove {u.username}
                </button>
                <button type="button" className="btn" onClick={() => setConfirming(null)}>Keep it</button>
              </div>
            ) : (
              <div className="skip-row">
                <button type="button" className="btn" onClick={() => { setResetting(u.id); setMessage(''); }}>
                  Reset password<span className="sr-only"> for {u.username}</span>
                </button>
                <button type="button" className="btn" onClick={() => { setConfirming(u.id); setMessage(''); }}>
                  Remove<span className="sr-only"> {u.username}</span>
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Manager({ onSignOut }: { onSignOut: () => void }) {
  const { data, error, loading, retry } = useAsync(api.adminList, []);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const subjects = [...new Set((data ?? []).map((p) => p.subject))].sort();

  const expired = !!error && /sign in/i.test(error);
  useEffect(() => {
    if (expired) {
      setToken(null);
      onSignOut();
    }
  }, [expired, onSignOut]);

  if (error) return <ErrorBox message={error} onRetry={retry} />;

  async function remove(p: AdminPodcast) {
    setActionError('');
    try {
      await api.adminDelete(p.id);
      setConfirming(null);
      setMessage(`Removed “${p.title}”.`);
      retry();
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  return (
    <>
      <div role="status" className="sr-only">{message}</div>
      {message && <p className="preview">{message}</p>}
      <button type="button" className="btn" onClick={() => { setToken(null); onSignOut(); }}>
        Sign out
      </button>

      <section aria-labelledby="add-h" className="section">
        <h2 id="add-h">Add a podcast</h2>
        <PodcastForm subjects={subjects} onSaved={() => { setMessage('Podcast added.'); retry(); }} />
      </section>

      <section aria-labelledby="list-h" className="section">
        <h2 id="list-h">Podcasts in the library</h2>
        {loading && !data && <Loading />}
        {actionError && <ErrorBox message={actionError} />}
        <ul className="admin-list">
          {data?.map((p) => (
            <li key={p.id} className="admin-item">
              {editing === p.id ? (
                <PodcastForm
                  initial={p}
                  subjects={subjects}
                  onSaved={() => { setEditing(null); setMessage(`Saved “${p.title}”.`); retry(); }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <h3>{p.title}</h3>
                  <p className="muted">
                    Subject: {p.subject}
                    {p.error ? ' · This feed cannot be read right now' : ''}
                  </p>
                  {confirming === p.id ? (
                    <div className="skip-row">
                      <button type="button" className="btn btn-danger" onClick={() => remove(p)}>
                        Yes, remove {p.title}
                      </button>
                      <button type="button" className="btn" onClick={() => setConfirming(null)}>
                        Keep it
                      </button>
                    </div>
                  ) : (
                    <div className="skip-row">
                      <button type="button" className="btn" onClick={() => setEditing(p.id)}>
                        Edit<span className="sr-only"> {p.title}</span>
                      </button>
                      <button type="button" className="btn" onClick={() => setConfirming(p.id)}>
                        Remove<span className="sr-only"> {p.title}</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
      <Accounts />
    </>
  );
}

export default function Admin() {
  const [signedIn, setSignedIn] = useState(!!getToken());
  return (
    <>
      <PageHeading title="Manage podcasts">Manage podcasts</PageHeading>
      {signedIn ? <Manager onSignOut={() => setSignedIn(false)} /> : <Login onDone={() => setSignedIn(true)} />}
    </>
  );
}

