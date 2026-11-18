import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ScopedReview } from './ScopedReview.js';
import './styles.css';
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('review') ? <ScopedReview/> : <App/>);
