import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import DesignRefApp from './design-ref/DesignRefApp.jsx';
import { initTelegram } from './lib/telegram.js';
import './styles/tokens.css';
import './styles/globals.css';

initTelegram();

const params = new URLSearchParams(windo