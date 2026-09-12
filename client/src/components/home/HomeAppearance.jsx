import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import '../../styles/homeAppearance.css';

export const HOME_APPEARANCE_KEY = 'railbird.home.appearance';
const MODES = ['auto', 'day', 'dusk', 'night'];
const NAMES = { day: 'Warm Day', dusk: 'Amber Dusk', night: 'Warm Night' };

// Local wall-clock hours, not sunrise/sunset. Appearance never changes play,
// fatigue, heat, schedules or the agent's state.
export function homePeriod(date = new Date()) {
  const hour = date.getHours();
  return hour >= 6 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
}

function readPreference() {
  try {
    const value = localStorage.getItem(HOME_APPEARANCE_KEY);
    return MODES.includes(value) ? value : 'auto';
  } catch { return 'auto'; }
}

const Appearance = createContext(null);

export function HomeAppearanceProvider({ children }) {
  const inherited = useContext(Appearance);
  // App can also be mounted independently of the entry point. Share the outer
  // owner when present so a guest room cannot compete with its welcome page.
  return inherited ? children : <AppearanceOwner>{children}</AppearanceOwner>;
}

function AppearanceOwner({ children }) {
  const [preference, setPreference] = useState(readPreference);
  const [period, setPeriod] = useState(homePeriod);
  const theme = preference === 'auto' ? period : preference;
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-appearance');
    root.setAttribute('data-appearance', theme);
    // The document boundary includes sheets rendered in body portals, the
    // welcome page and every route. Changing light never remounts a game.
    return () => {
      if (previous === null) root.removeAttribute('data-appearance');
      else root.setAttribute('data-appearance', previous);
    };
  }, [theme]);
  useEffect(() => {
    const refresh = () => setPeriod(homePeriod());
    const sync = event => {
      if (event.key === HOME_APPEARANCE_KEY || event.key === null) setPreference(readPreference());
    };
    // Re-read the local clock after sleep, focus, clock/timezone changes, and
    // at the next minute. No network or location permission is needed.
    const timer = setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('storage', sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('storage', sync);
    };
  }, []);
  function choose(value) {
    if (!MODES.includes(value)) return;
    setPeriod(homePeriod());
    setPreference(value);
    try { localStorage.setItem(HOME_APPEARANCE_KEY, value); } catch { /* This session still works. */ }
  }
  return <Appearance.Provider value={{ preference, period, theme, choose }}>{children}</Appearance.Provider>;
}

export function useHomeAppearance() {
  const value = useContext(Appearance);
  return value ?? { preference: 'auto', period: homePeriod(), theme: homePeriod(), choose: () => {} };
}

export function HomeAppearanceControl() {
  const { preference, period, choose } = useHomeAppearance();
  return <label className="home-appearance">
    <span className="home-appearance__label">Home appearance</span>
    <select aria-label="Home appearance" value={preference} onChange={event => choose(event.target.value)}
      title="Auto follows your local clock: day 06–17, dusk 17–20, night 20–06. Lighting only.">
      <option value="auto">Auto · {period === 'day' ? 'Day' : period === 'dusk' ? 'Dusk' : 'Night'}</option>
      {Object.entries(NAMES).map(([value, name]) => <option value={value} key={value}>{name}</option>)}
    </select>
  </label>;
}
