# Brain Rot 🪰

A real fruit fly brain rates your LinkedIn post. The worse the post, the more the fly loves it.

**How it works**

1. The post is scanned for engagement bait (`public/app.js` → `BAIT`): humblebrags, 🚀, one-line paragraphs, "Agree?", "Let that sink in"… Bait = sugar. The score picks a sugar intensity (60–220 Hz).
2. That intensity selects one of ~500 precomputed whole-brain simulations: the Shiu et al. 2024 leaky integrate-and-fire model of the full FlyWire v783 connectome (139,255 neurons), with the fly's sugar-sensing neurons stimulated. (`public/runs.json`)
3. The firing rate of MN9 — the motor neuron that extends the proboscis — is the verdict. Sugar → MN9 is a validated result of the paper.
4. The 3D view is a self-hosted [Neuroglancer](https://github.com/google/neuroglancer) (`public/ng/`, Apache-2.0) streaming the real FlyWire meshes from Google Cloud Storage; neurons light up in spike order.
5. `api/rate.js` (Vercel function) logs each judged post to Supabase (`supabase.sql`).

**Regenerating the simulations** — copy `sim/*.py` into a checkout of [philshiu/Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model) (Python 3.12 venv with brian2, pandas, pyarrow, joblib):

```bash
cd ../Drosophila_brain_model
PYTHONPATH=. .venv/bin/python batch_sim.py 500     # ~45 min on an M-series Mac, 8 cores
PYTHONPATH=. .venv/bin/python prep_runs.py         # → ../flyfluencer/public/runs.json
```

**Local dev**: `cd public && python3 -m http.server 8787` → http://localhost:8787 (the API is skipped locally).

**Deploy**: Vercel, no build step (`npx vercel --prod`). Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. Run `supabase.sql` once in the Supabase SQL editor. Live: https://brainrot-posts.vercel.app

**Share image**: open `/?og=1`, wait for the run, screenshot the 1200×630 stage → `public/og.png`.
