"""results/runs.json (batch_sim output) -> ../flyfluencer/public/runs.json for the site.
Regenerates the stimulated sugar neurons from the run seed and converts brian indices to FlyWire ids."""
import json, random, pandas as pd
from flypost import SUGAR, MN9, COMP
df = pd.read_csv(COMP, index_col=0)
i2f = {i: f for i, f in enumerate(df.index)}; f2i = {f: i for i, f in i2f.items()}
sugar = [f for f in SUGAR if f in f2i]
out = []
for r in json.load(open('results/runs.json')):
    rng = random.Random(r['k']); n_stim = rng.randint(6, len(sugar)); chosen = rng.sample(sugar, n_stim)
    assert n_stim == r['n_stim'] and r['rate'] in (60, 90, 120, 150, 180, 220)
    out.append({'k': r['k'], 'rate': r['rate'], 'mn9': r['mn9'], 'active': r['n_active'], 'spikes': r['n_spikes'],
                'named': r['named'], 'stim': [str(f) for f in chosen],
                'seq': [[t, str(i2f[i])] for t, i in r['dec']]})
json.dump(out, open('../flyfluencer/public/runs.json', 'w'), separators=(',', ':'))
import collections
print(len(out), 'runs;', 'by rate:', dict(collections.Counter(r['rate'] for r in out)),
      '| mn9 by rate:', {rt: round(sum(r['mn9'] for r in out if r['rate']==rt)/max(1,sum(1 for r in out if r['rate']==rt))) for rt in (60,90,120,150,180,220)})
