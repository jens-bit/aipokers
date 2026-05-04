// Stroke icon set — match brand: 1.6-1.8 stroke, clean, minimal

const Icon = ({ name, size = 20, color = 'currentColor', strokeWidth = 1.7 }) => {
  const s = strokeWidth;
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth: s,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { display: 'block', flexShrink: 0 },
  };

  switch (name) {
    case 'arrow-left':
      return <svg {...common}><path d="M15 18l-6-6 6-6"/></svg>;
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      );
    case 'home':
      return <svg {...common}><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>;
    case 'spade':
      return (
        <svg {...common} fill={color} stroke="none">
          <path d="M12 2 C12 2, 4 9, 4 14 C4 17, 6 19, 9 19 C10.5 19, 11.5 18.3, 12 17.3 C12.5 18.3, 13.5 19, 15 19 C18 19, 20 17, 20 14 C20 9, 12 2, 12 2 Z M11 18 L9.5 22 L14.5 22 L13 18 Z"/>
        </svg>
      );
    case 'agent':
      // simple bot/face
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="14" rx="3"/>
          <path d="M12 3v3"/>
          <circle cx="9" cy="13" r="1.2" fill={color}/>
          <circle cx="15" cy="13" r="1.2" fill={color}/>
          <path d="M9 17h6"/>
        </svg>
      );
    case 'history':
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7"/>
          <path d="M3 4v5h5"/>
          <path d="M12 8v4l3 2"/>
        </svg>
      );
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
        </svg>
      );
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/>
          <path d="M5 4H3v2a3 3 0 0 0 3 3"/>
          <path d="M19 4h2v2a3 3 0 0 1-3 3"/>
          <path d="M9 17h6v3H9z"/>
          <path d="M8 20h8"/>
        </svg>
      );
    case 'bar-chart':
      return (
        <svg {...common}>
          <path d="M4 20V10"/>
          <path d="M10 20V4"/>
          <path d="M16 20v-8"/>
          <path d="M22 20H2"/>
        </svg>
      );
    case 'check':
      return <svg {...common}><path d="M5 12l5 5 9-11"/></svg>;
    case 'chevron-right':
      return <svg {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chip':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9"/>
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>
        </svg>
      );
    case 'dot':
      return <svg {...common} fill={color} stroke="none"><circle cx="12" cy="12" r="4"/></svg>;
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>
        </svg>
      );
    default:
      return null;
  }
};

Object.assign(window, { Icon });
