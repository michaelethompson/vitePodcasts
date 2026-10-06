import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { usePlayer } from './context/PlayerContext';
import Account from './pages/Account';
import Admin from './pages/Admin';
import Home from './pages/Home';
import PlayerPage from './pages/PlayerPage';
import PodcastPage from './pages/PodcastPage';
import Settings from './pages/Settings';

function NowPlayingLink() {
  const { current, playing } = usePlayer();
  const { pathname } = useLocation();
  if (!current) return null;
  const to = `/podcast/${encodeURIComponent(current.podcastId)}/episode/${encodeURIComponent(current.episode.id)}`;
  if (pathname === to) return null;
  return (
    <Link to={to} className="btn btn-primary now-playing">
      <span aria-hidden="true">{playing ? '🔊' : '⏸'}</span> {playing ? 'Now playing' : 'Paused'}: {current.episode.title}
    </Link>
  );
}

export default function App() {
  const { username } = useAuth();
  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      <header className="site-header">
        <nav aria-label="Main">
          <NavLink to="/" end className="nav-link">Library</NavLink>
          <NavLink to="/settings" className="nav-link">Settings</NavLink>
          <NavLink to="/account" className="nav-link">{username ? 'My account' : 'Sign in'}</NavLink>
        </nav>
        <NowPlayingLink />
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/podcast/:id" element={<PodcastPage />} />
          <Route path="/podcast/:id/episode/:episodeId" element={<PlayerPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<p>That page does not exist. <Link to="/">Go to the Library</Link></p>} />
        </Routes>
      </main>
      <footer className="site-footer">
        <Link to="/admin">Manage podcasts</Link>
      </footer>
    </>
  );
}
