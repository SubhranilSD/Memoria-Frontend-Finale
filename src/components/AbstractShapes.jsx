import './AbstractShapes.css';

// Each shape is wrapped in a static-blur parent.
// The browser blurs ONCE and caches it as a GPU texture.
// Only transform + opacity animate — zero paint cost, runs fully on compositor thread.
export default function AbstractShapes() {
  return (
    <div className="abstract-shapes">
      <div className="shape-blur-wrap shape-blur-a">
        <div className="shape shape-1" />
      </div>
      <div className="shape-blur-wrap shape-blur-b">
        <div className="shape shape-2" />
      </div>
      <div className="shape-blur-wrap shape-blur-c">
        <div className="shape shape-3" />
      </div>
      <div className="shape-blur-wrap shape-blur-b">
        <div className="shape shape-4" />
      </div>
      <div className="shape-blur-wrap shape-blur-a">
        <div className="shape shape-5" />
      </div>
    </div>
  );
}
