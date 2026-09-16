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

**Deploy**: Vercel, no build step (`npx vercel --prod`). Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. Run `supabase.sql` once in the Supabase SQL editor. Live: https://brainrotposts.com

**Share image**: open `/?og=1`, wait for the run, screenshot the 1200×630 stage → `public/og.png`.

## Hall of Rot opt-in and sense experiments

- Scoring saves a private rating and returns an ID plus a per-result publication receipt. Only an explicit click on **Add to Hall of Rot** publishes that result; the receipt stays attached to the visible result while editing and is cleared when submitting or starting a new post.
- The public leaderboard and voting function only include `is_public = true` rows. Existing ratings stay private because they have no recorded opt-in.
- After scoring, **Light up another sense** shows the simulation's stimulated inputs for that post, prioritizes inactive senses, and preserves the post when the visitor chooses to edit it.
- Rot scores combine the simulated response with caps for text length, vocabulary variety and the number of bait patterns. A short trigger phrase cannot earn 90–100%; activating more senses does not itself increase the score.
- Sense buttons explain their input inline on hover/focus and load a tested example on click, with a restore-draft action. Editing preserves the last result and its sharing controls until resubmission.
- Samples progress through sugar + sight, smell + hearing, then sugar + bitter + smell + sight, scoring 65%, 52% and 84%. They use the ordinary scoring rules. `npm test` checks each against the actual simulation files and verifies that original posts can still score 100. API and interaction tests use mocks; they do not publish real posts.

### Release order

Apply `supabase/migrations/20260915010000_hall_opt_in.sql` to the existing database immediately before deploying the updated API/frontend together. Fresh installs should use the complete `supabase.sql`. The new API fails closed if the consent columns are absent. The static local preview has no database API, so its hall is unavailable and it cannot publish results.

### Result image downloads

**Save result image** previews a local 1200×1200 PNG containing the actual Neuroglancer frame captured at scoring, fly, rating, verdict and activated senses. Editing the draft preserves that result. Visitors download the PNG and attach it themselves; the site does not post to LinkedIn. Hall of Rot entries retain their full text and paragraph breaks.
