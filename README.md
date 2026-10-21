# Print Cost Estimator

Upload a 3D model (STL, OBJ, 3MF, PLY, GLB/glTF) and see how much resin it would use, and what it would cost, on popular resin printers. Built with Next.js, React Three Fiber and Three.js. Everything runs in the browser; files are never uploaded.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel

Option A, the dashboard: push this folder to a GitHub repo, then on vercel.com choose **Add New → Project**, import the repo and click **Deploy**. Vercel detects Next.js automatically; you don't need to change any settings.

Option B, the CLI:

```bash
npm i -g vercel
vercel        # first run links the project and makes a preview deploy
vercel --prod # production deploy
```

## How the estimate works

- **Volume**: the signed-tetrahedron (divergence theorem) sum over every triangle, with each part's volume taken as an absolute value so inverted normals still count. This is exact for closed (watertight) meshes. The app counts open edges and warns you when a mesh isn't watertight.
- **Solid print**: the volume is treated as solid resin. A "Supports & waste" slider (default 10%) adds overhead.
- **Cost**: prices per kg are converted using resin density (default 1.10 g/ml). Prices per liter (Formlabs) are used directly. Every price is editable in the table.
- **Fit**: the app checks the model's bounding box against each printer's build volume as-is, then in any axis orientation.
- **Time**: a rough guess from model height ÷ typical vertical speed. Resin printers cure a whole layer at once, so time depends on height, not volume.
- **Units**: STL, 3MF, PLY and OBJ default to millimeters. glTF defaults to meters, as the spec requires. You can override the units in the app.

## Editing printers and prices

Edit `lib/printers.ts`. Each entry has a build volume in mm, a default resin and price (`unit: "kg"` or `"L"`), and a rough speed in mm/hour. The defaults are approximate late-2026 list prices; resin sales move them often.

## Ideas for later

- Hollowing and infill (wall thickness and drain holes)
- Auto-orient to minimize height or supports
- Per-printer resin pickers (tough, ABS-like, castable…)
- Electricity, IPA and FEP wear in the cost
