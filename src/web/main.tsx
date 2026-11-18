import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ScopedReview } from './ScopedReview.js';
import { ScopedExport } from './ScopedExport.js';
import './styles.css';
const query = new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(query.has('review') ? <ScopedReview/> : query.has('export') ? <ScopedExport/> : <App/>);
