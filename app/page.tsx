import AdminMenu from "@/components/AdminMenu";
import { AdminProvider } from "@/components/AdminContext";
import QuoteApp from "@/components/QuoteApp";

export default function Home() {
  return (
    <AdminProvider>
      <header className="site-header">
        <div className="wrap header-inner">
          <a className="brand" href="https://www.artifactory3d.com/" aria-label="Artifactory3D home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.artifactory3d.com/wp-content/uploads/sites/11/2019/06/Artifactory3d_Logo.png"
              alt="Artifactory3D"
              width={196}
              height={45}
            />
          </a>
          <nav className="header-nav">
            <a href="https://www.artifactory3d.com/">Home</a>
            <AdminMenu />
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <h1>Instant 3D printing quote</h1>
          <p>Upload your parts, choose SLA, PolyJet or FDM, and see your price in seconds.</p>
        </div>
      </section>

      <main className="wrap main">
        <QuoteApp />
      </main>

      <footer className="wrap foot">
        Estimates only. Your files are processed in your browser and never uploaded. For a final quote,{" "}
        <a href="https://www.artifactory3d.com/contact/">contact Artifactory3D</a>.
      </footer>
    </AdminProvider>
  );
}
