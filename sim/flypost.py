"""
flypost.py — a fruit fly brain writes your LinkedIn post.

Pipeline (same trick as "fly brain plays Doom"):
  topic text  -> which sugar-sensing neurons get stimulated, and how hard
  whole-brain leaky integrate-and-fire simulation (Shiu et al. 2024, FlyWire 783)
  spike train -> every word choice in the post is made by the next neuron to fire
  MN9 (proboscis motor neuron) firing rate -> how enthusiastic the post is

Usage:  python flypost.py "partnerships are the new sales"
"""
import sys, json, hashlib, pickle, time, urllib.parse
from pathlib import Path
import pandas as pd
from brian2 import ms, Hz, seed
from model import run_trial, default_params

COMP = 'Completeness_783.csv'
CON  = 'Connectivity_783.parquet'
MN9  = 720575940660219265
SUGAR = [720575940624963786,720575940630233916,720575940637568838,720575940638202345,
         720575940617000768,720575940630797113,720575940632889389,720575940621754367,
         720575940621502051,720575940640649691,720575940639332736,720575940616885538,
         720575940639198653,720575940620900446,720575940617937543,720575940632425919,
         720575940633143833,720575940612670570,720575940628853239,720575940629176663,
         720575940611875570]

SWEET = {'partner','partnership','partnerships','growth','win','trust','together','ecosystem',
         'revenue','community','collaboration','love','grateful','humbled','excited','launch',
         'closed','deal','yes','signed','sugar','fruit','banana'}
BITTER = {'exclusivity','exclusive','churn','legal','procurement','redline','no','rejected',
          'burnout','layoffs','vinegar','quinine','synergy','synergies','alignment'}

# ---------- the LinkedIn grammar; each slot is one decision the fly makes ----------
G = {
 'hook': [
  "Unpopular opinion: {claim}.",
  "I got rejected by {n} partners last year. Here's what it taught me:",
  "Nobody talks about this in partnerships.",
  "3 years ago I had 0 partners. Today I have {n}. Here's the playbook:",
  "Hot take: {claim}.",
  "I just got off a call that changed how I think about {thing}.",
  "Stop {verbing}. Start {verbing2}.",
  "{claim}. Let that sink in.",
  "A founder DM'd me yesterday asking about {thing}. My answer surprised them.",
  "Most partnerships die in the first {n} days. Here's why:",
 ],
 'claim': [
  "partnerships are just sales with better manners",
  "your best channel is someone else's customer list",
  "nobody reads the partner deck",
  "'let's explore synergies' is a no",
  "the best partnership is the one you can cancel in one email",
  "distribution beats product",
  "a warm intro is worth 40 cold emails",
  "you don't need more partners, you need one that actually cares",
  "exclusivity is a trap",
  "co-marketing is not a strategy",
 ],
 'thing': ["partnerships","channel sales","co-selling","ecosystems","distribution","integrations",
           "referral deals","rev share","partner enablement","go-to-market"],
 'verbing': ["chasing logos","sending decks","asking for exclusivity","building integrations nobody asked for",
             "waiting for the perfect partner","calling it 'synergy'","measuring MQLs","doing quarterly business reviews"],
 'verbing2': ["asking who actually owns the relationship","sending one honest message","picking up the phone",
              "shipping the thing","asking for the intro","closing the loop","writing the one-pager","saying no"],
 'n': ["3","7","12","14","30","47","90","100","200"],
 'line': [
  "It's not about the contract. It's about {noun}.",
  "The best partners I've worked with had one thing in common: {trait}.",
  "Here's what actually moves the needle: {mover}.",
  "I used to think it was {noun}. It's not. It's {noun2}.",
  "Every partnership I've closed came down to {mover}.",
  "The math is simple. {mover} > {noun}.",
  "We didn't need a bigger team. We needed {mover}.",
  "This is the part nobody puts in the playbook: {mover}.",
 ],
 'noun': ["the deck","the logo","the term sheet","the QBR","the CRM","the roadmap","the MDF budget",
          "the integration","the press release","the org chart"],
 'noun2': ["trust","follow-through","one person who cares","picking up the phone","clarity","timing",
           "showing up","a shared customer","saying what you want","the second meeting"],
 'trait': ["they answered in under an hour","they said no fast","they had skin in the game",
           "they never used the word 'synergy'","they introduced me before I asked","they cared about the customer more than the deal",
           "they shipped","they had one owner, not a committee"],
 'mover': ["one warm intro","a shared customer","a clear owner","a 14-day counterparty","saying no to exclusivity",
           "a one-page agreement","doing the first deal by hand","asking what they actually need","a kill date","showing up twice"],
 'bullet': [
  "Lead with the customer, not the logo.",
  "One owner. Never a committee.",
  "If it can't ship in 14 days, it won't ship.",
  "Say no to exclusivity. Every time.",
  "A one-pager beats a 40-slide deck.",
  "Ask for the intro. Then ask again.",
  "Rev share aligns. MDF distracts.",
  "The second meeting is where deals happen.",
  "Kill dead partnerships in writing.",
  "Warm > cold. Always.",
  "Measure closed revenue, not signed MOUs.",
  "Distribution is the product.",
 ],
 'closer': [
  "Agree?", "What's your take?", "Repost if this resonated ♻️", "Follow for more on {thing}.",
  "Curious how others handle this.", "Save this for your next partner call.",
  "This is the way.", "Comment 'PARTNER' and I'll send you the template.",
  "Building in public. More soon.", "Thoughts?",
 ],
 'tags': ["#partnerships","#gtm","#founders","#startups","#b2b","#sales","#ecosystem","#buildinpublic",
          "#leadership","#growth","#saas","#distribution","#lessonslearned","#thepartnership"],
 'punch': ["Simple.","Full stop.","That's it. That's the post.","Every. Single. Time.","No exceptions.",
           "Read that again.","Most people skip this.","It's not complicated."],
}

class FlyWriter:
    """Expands the grammar; every choice consumes the next spike."""
    def __init__(self, spikes, n_decisions=60):   # spikes: list of (t, brian_idx) sorted by time
        stride = max(1, len(spikes) // n_decisions)  # spread decisions across the whole trial
        self.spikes = spikes[::stride]; self.pos = 0; self.used = []
    def pick(self, options):
        t, i = self.spikes[self.pos % len(self.spikes)]; self.pos += 1
        self.used.append((t, i))
        return options[i % len(options)]
    def expand(self, key):
        s = self.pick(G[key])
        while '{' in s:
            a = s.index('{'); b = s.index('}', a)
            s = s[:a] + self.expand(s[a+1:b]) + s[b+1:]
        return s

def encode_topic(topic):
    """Topic -> (subset of sugar neurons to stimulate, Poisson rate, RNG seed)."""
    words = [w.strip('.,!?#').lower() for w in topic.split()]
    sweet  = sum(w in SWEET for w in words); bitter = sum(w in BITTER for w in words)
    rate = max(60, min(220, 130 + 30*sweet - 40*bitter))          # Hz
    h = int(hashlib.sha256(topic.lower().encode()).hexdigest(), 16)
    chosen = [f for k, f in enumerate(SUGAR) if (h >> k) & 1]
    if len(chosen) < 8:                                             # need enough input to wake the brain
        chosen = SUGAR[:8] + chosen
    return chosen, rate, h % (2**31)

def neuroglancer_url(flyids):
    state = {
      "layers": [
        {"type": "segmentation", "source": "precomputed://gs://flywire_v141_m783",
         "segments": [str(i) for i in flyids], "name": "neurons that wrote this post"},
      ],
      "dimensions": {"x": [1.6e-8, "m"], "y": [1.6e-8, "m"], "z": [4e-8, "m"]},
      "position": [34000, 19000, 3000], "projectionScale": 28000,
      "layout": "3d", "showSlices": False,
    }
    return "https://neuroglancer-demo.appspot.com/#!" + urllib.parse.quote(json.dumps(state, separators=(',',':')))

def main(topic, t_run_ms=1000):
    df = pd.read_csv(COMP, index_col=0)
    f2i = {f: i for i, f in enumerate(df.index)}; i2f = {i: f for f, i in f2i.items()}
    chosen, rate, s = encode_topic(topic)
    chosen = [f for f in chosen if f in f2i]
    P = dict(default_params); P['r_poi'] = rate * Hz; P['t_run'] = t_run_ms * ms
    seed(s)
    print(f">>> topic: {topic!r}\n>>> tasting it: {len(chosen)} sugar neurons @ {rate} Hz, seed {s}\n>>> simulating 139,255 neurons for {t_run_ms} ms of brain time...", flush=True)
    t0 = time.time()
    spk = run_trial([f2i[f] for f in chosen], [], [], COMP, CON, P)
    wall = time.time() - t0
    stim = {f2i[f] for f in chosen}
    events = sorted((float(t), i) for i, ts in spk.items() if i not in stim for t in ts)
    if len(events) < 20:
        sys.exit("The fly did not respond. Try a sweeter topic.")
    mn9_hz = len(spk.get(f2i[MN9], [])) / (t_run_ms / 1000)
    enthusiasm = min(4, int(mn9_hz // 20))                          # 0..4 from proboscis extension rate

    W = FlyWriter(events)
    n_lines = 2 + len(events) // 3000
    lines = [W.expand('hook'), ""]
    for _ in range(min(n_lines, 4)): lines.append(W.expand('line'))
    lines += ["", W.expand('punch'), ""]
    bullets = []
    while len(bullets) < 3:
        b = W.expand('bullet')
        if b not in bullets: bullets.append(b)
    lines += [f"→ {b}" for b in bullets]
    closer = W.expand('closer')
    if enthusiasm: closer = closer.rstrip('.?!') + "!" * enthusiasm
    lines += ["", closer, ""]
    tags = []
    while len(tags) < 3 + enthusiasm // 2:
        t = W.expand('tags')
        if t not in tags: tags.append(t)
    lines.append(" ".join(tags))
    post = "\n".join(lines)

    # who gets the byline
    sez = pickle.load(open('sez_neurons.pickle', 'rb'))
    active_ids = {i2f[i] for i in spk}
    credits = sorted(name for name, ids in sez.items() if active_ids & set(ids))
    authors = {i2f[i] for _, i in W.used}
    print("\n" + "="*60 + "\n" + post + "\n" + "="*60)
    print(f"\nWritten by {len(authors)} neurons ({len(W.used)} decisions) out of {len(spk)} that fired "
          f"({sum(len(v) for v in spk.values())} spikes in {t_run_ms} ms of brain time, {wall:.0f} s wall time).")
    print(f"MN9 proboscis motor neuron: {mn9_hz:.0f} Hz -> enthusiasm {enthusiasm}/4"
          + (" (the fly is licking the screen)" if enthusiasm >= 3 else ""))
    if credits: print(f"With contributions from named neurons: {', '.join(credits[:12])}" + (" ..." if len(credits) > 12 else ""))
    url = neuroglancer_url(sorted(authors))
    out = Path('results/flypost'); out.mkdir(parents=True, exist_ok=True)
    fn = out / (hashlib.sha1(topic.encode()).hexdigest()[:8] + '.json')
    json.dump({'topic': topic, 'post': post, 'rate_hz': rate, 'stimulated': chosen, 'mn9_hz': mn9_hz,
               'authors': sorted(authors), 'n_active': len(spk), 'credits': credits, 'neuroglancer': url},
              open(fn, 'w'), indent=1)
    print(f"\nSee the authors in 3D (Neuroglancer):\n{url}\n\nsaved -> {fn}")

if __name__ == '__main__':
    main(" ".join(sys.argv[1:]) or "partnerships")
