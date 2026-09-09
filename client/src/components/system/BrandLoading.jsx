// Board 41 B12: the chosen first line, shown only while the app is loading.
import { RailMark } from './RailMark.jsx';
import './brand-loading.css';
export function BrandLoading() {
  return <div className="brand-loading" role="status" aria-label="Loading Railbird" aria-busy="true">
    <div className="brand-loading__mark"><RailMark size={150}/></div>
    <p>You don’t play. You raise a player.</p>
  </div>;
}
