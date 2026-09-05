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
          <path d="M12 2.4 C12 2.4 4.6 8.8 4.6 13.9 C4.6 16.7 6.5 18.7 9 18.7 C10.1 18.7 11 18.3 11.6 17.6 C11.7 19.6 11 21.2 9.4 22.2 L14.6 22.2 C13 21.2 12.3 19.6 12.4 17.6 C13 18.3 13.9 18.7 15 18.7 C17.5 18.7 19.4 16.7 19.4 13.9 C19.4 8.8 12 2.4 12 2.4 Z"/>
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
    case 'edit':
      return <svg {...common}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>;
    case 'info':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v5h1"/></svg>;
    case 'templates':
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'send':
      return <svg {...common}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg>;
    case 'target':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill={color}/></svg>;
    case 'scales':
      return <svg {...common}><path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-3 6h6l-3-6z"/><path d="M19 7l-3 6h6l-3-6z"/><path d="M8 21h8"/></svg>;
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'risk':
      return <svg {...common}><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5"/><path d="M12 18h.01"/></svg>;
    case 'tilt':
      return <svg {...common}><path d="M3 12c3-4 6-4 9 0s6 4 9 0"/></svg>;
    case 'bet':
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 1 1 0 3h-3a1.5 1.5 0 1 0 0 3h4"/></svg>;
    case 'percent':
      return <svg {...common}><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M19 5L5 19"/></svg>;
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'chevron-down':
      return <svg {...common}><path d="M6 9l6 6 6-6"/></svg>;
    default:
      return null;
  }
};

Object.assign(window, { Icon });
