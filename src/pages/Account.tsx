import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { ErrorBox, Segmented } from '../components/Status';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

function PasswordField({ id, label, value, onChange, show, autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; autoComplete: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} required />
    </div>
  );
}

function ShowPassword({ show, onChange }: { show: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={show} onChange={(e) => onChange(e.target.checked)} /> Show password
    </label>
  );
}

function SignInForm() {
  const { signIn, register } = useAuth();
  const [mode, setMode] = useState<'signin' | 'create'>('signin');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await (mode === 'create' ? register : signIn)(name, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <p>
        Signing in is optional. An account saves your favorites, your place in each episode and your display settings, so
        they follow you to your other devices.
      </p>
      <Segmented
        legend="I want to"
        name="auth-mode"
        value={mode}
        onChange={(m) => { setMode(m); setError(''); }}
        options={[
          { value: 'signin', label: 'Sign in' },
          { value: 'create', label: 'Create an account' },
        ]}
      />
      <form onSubmit={submit} className="form">
        <div className="field">
          <label htmlFor="acct-name">Your name</label>
          <input id="acct-name" autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={30} />
          {mode === 'create' && <p className="muted small">3 to 30 letters or numbers. Choose any name you will remember.</p>}
        </div>
        <PasswordField
          id="acct-pw"
          label="Password"
          value={password}
          onChange={setPassword}
          show={show}
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
        />
        {mode === 'create' && <p className="muted small">At least 8 characters. A few easy words together works well.</p>}
        <ShowPassword show={show} onChange={setShow} />
        {error && <ErrorBox message={error} />}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'create' ? 'Create my account' : 'Sign in'}
        </button>
        {mode === 'signin' && <p className="muted small">Forgot your password? Ask the person who runs this library to reset it.</p>}
      </form>
    </>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setDone(false);
    try {
      await api.changePassword(current, next);
      setDone(true);
      setCurrent('');
      setNext('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section" aria-labelledby="pw-h">
      <h2 id="pw-h">Change my password</h2>
      <form onSubmit={submit} className="form">
        <PasswordField id="pw-cur" label="Current password" value={current} onChange={setCurrent} show={show} autoComplete="current-password" />
        <PasswordField id="pw-new" label="New password (at least 8 characters)" value={next} onChange={setNext} show={show} autoComplete="new-password" />
        <ShowPassword show={show} onChange={setShow} />
        {error && <ErrorBox message={error} />}
        {done && <p role="status" className="preview">Your password has been changed.</p>}
        <button type="submit" className="btn" disabled={busy}>Change password</button>
      </form>
    </section>
  );
}

export default function Account() {
  const { username, signedIn, signOut } = useAuth();
  return (
    <>
      <PageHeading title={signedIn ? 'My account' : 'Sign in'}>{signedIn ? 'My account' : 'Sign in'}</PageHeading>
      {signedIn ? (
        <>
          <p>
            You are signed in as <strong>{username}</strong>. Your favorites, your place in each episode and your settings
            are saved to your account.
          </p>
          <div className="skip-row">
            <Link to="/" className="btn btn-primary">Go to the Library</Link>
            <button type="button" className="btn" onClick={signOut}>Sign out</button>
          </div>
          <p className="muted small">Signing out clears favorites and listening places from this device. They stay saved in your account.</p>
          <ChangePassword />
        </>
      ) : (
        <SignInForm />
      )}
    </>
  );
}
