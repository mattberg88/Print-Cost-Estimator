import Estimator from "@/components/Estimator";

export default function Home() {
  return (
    <main className="container">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
              <path d="m3 7 9 5 9-5M12 12v10" />
            </svg>
          </span>
          <h1>Print Cost Estimator</h1>
        </div>
        <p className="tagline">Drop in a model and see what it costs in resin on popular printers.</p>
      </header>
      <Estimator />
      <footer className="foot">
        Estimates only. Volume is computed from the mesh in your browser; your file never leaves your device.
      </footer>
    </main>
  );
}
