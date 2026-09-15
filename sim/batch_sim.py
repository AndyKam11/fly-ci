"""Precompute N real whole-brain simulations; one fresh process per run, one JSON per run (resumable).
Run k: a seeded random subset of the sugar neurons, a stimulation rate, and seed k."""
import json, sys, random, os, time, pickle
from pathlib import Path
from multiprocessing import Pool

N = int(sys.argv[1]) if len(sys.argv) > 1 else 300
WORKERS = int(sys.argv[2]) if len(sys.argv) > 2 else 5
N_DEC = 80
RATES = [60, 90, 120, 150, 180, 220]
OUT = Path('results/runs'); OUT.mkdir(parents=True, exist_ok=True)

def one(k):
    if (OUT / f'{k}.json').exists(): return k, 'skip'
    import pandas as pd
    from brian2 import ms, Hz, seed
    from model import run_trial, default_params
    from flypost import SUGAR, MN9, COMP, CON
    SEZ = pickle.load(open('sez_neurons.pickle', 'rb')); NAMED = {i: n for n, ids in SEZ.items() for i in ids}
    df = pd.read_csv(COMP, index_col=0)
    f2i = {f: i for i, f in enumerate(df.index)}; i2f = {i: f for f, i in f2i.items()}
    sugar = [f for f in SUGAR if f in f2i]
    rng = random.Random(k)
    n_stim = rng.randint(6, len(sugar)); chosen = rng.sample(sugar, n_stim); rate = rng.choice(RATES)
    P = dict(default_params); P['r_poi'] = rate * Hz; P['t_run'] = 1000 * ms
    seed(k)
    spk = run_trial([f2i[f] for f in chosen], [], [], COMP, CON, P)
    stim = {f2i[f] for f in chosen}
    ev = sorted((float(t), i) for i, ts in spk.items() if i not in stim for t in ts)
    if len(ev) < 20: return k, 'quiet'
    stride = max(1, len(ev) // N_DEC); dec = ev[::stride][:N_DEC]
    r = {'k': k, 'rate': rate, 'n_stim': n_stim, 'n_active': len(spk), 'n_spikes': sum(len(v) for v in spk.values()),
         'mn9': len(spk.get(f2i[MN9], [])),
         'dec': [[round(t*1000), i] for t, i in dec],
         'ids': [str(i2f[i]) for i in sorted({i for _, i in dec})],
         'named': sorted({NAMED[i2f[i]] for i in spk if i2f[i] in NAMED})}
    json.dump(r, open(OUT / f'{k}.json', 'w'), separators=(',', ':'))
    return k, f"rate {rate} mn9 {r['mn9']}"

if __name__ == '__main__':
    t0 = time.time(); done = 0
    with Pool(WORKERS, maxtasksperchild=1) as pool:          # fresh process per run: no memory pile-up
        for k, msg in pool.imap_unordered(one, range(N)):
            done += 1
            if msg != 'skip': print(f'{done}/{N} run {k}: {msg} ({time.time()-t0:.0f}s)', flush=True)
    runs = [json.load(open(p)) for p in sorted(OUT.glob('*.json'), key=lambda p: int(p.stem))]
    json.dump(runs, open('results/runs.json', 'w'), separators=(',', ':'))
    print(f'{len(runs)} runs -> results/runs.json')
