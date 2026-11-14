# Print Cost Estimator

Upload a 3D model (STL, OBJ, 3MF, PLY, GLB/glTF) and get SLA, PolyJet and FDM price estimates using the AMFG simplified pricing logic. Built with Next.js, React Three Fiber and Three.js. Everything runs in the browser; files are never uploaded.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel

Push this folder to a GitHub repo, then on vercel.com choose **Add New → Project**, import the repo and click **Deploy**. Or run `npx vercel --prod` from this folder.

## How it works

- **Measurements** (`lib/geometry.ts`): volume (signed-tetrahedron sum; exact for watertight meshes), surface area, bounding box, and an estimated support volume with the part laid on its shortest side (heightmap of the top surface minus part volume).
- **Pricing** (`lib/quote.ts`): SLA, PolyJet and FDM formulas from pages 1–3 of the AMFG quote logic. Volume in mm³, area in mm². All constants live at the top of each section.
  - PolyJet layer height is 0.016 mm (16 microns).
  - FDM skin term uses surface area in cm² ÷ 10 (a 1 mm shell).
  - Prices are raw formula output (including markup and setup). A $200 minimum order is optional in the UI.
- **Units**: STL/3MF/PLY/OBJ default to millimeters, glTF to meters; overridable in the app.

Run `npm run verify` to print sanity checks (known-volume shapes and the sample part's quotes).
