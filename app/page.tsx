import AdminMenu from "@/components/AdminMenu";
import { AdminProvider } from "@/components/AdminContext";
import Estimator from "@/components/Estimator";

export default function Home() {
  return (
    <AdminProvider>
      <header className="site-header">
        <div className="wrap header-inner">
          <a className="wordmark" href="https://www.artifactory3d.com/" aria-label="Artifactory3D home">
            Artifactory<sup>3D</sup>
          </a>
          <nav className="header-nav">
            <a href="https://www.artifactory3d.com/">Home</a>
            <a className="btn-outline" href="https://www.artifactory3d.com/contact/">
              Get a Quote
            </a>
            <AdminMenu />
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <h1>Print Cost Estimator</h1>
          <p>Upload a 3D model to get an instant SLA, PolyJet and FDM price estimate.</p>
        </div>
      </section>

      <main className="wrap main">
        <Estimator />
      </main>

      <footer className="wrap foot">
        Estimates only. Your file is processed in your browser and never uploaded. For a final quote,{" "}
        <a href="https://www.artifactory3d.com/contact/">contact Artifactory3D</a>.
      </footer>
    </AdminProvider>
  );
}
