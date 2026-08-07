# Static Delivery Investigation — «لعبة نوف»

**Agent:** `static-delivery-expert` · **Path:** تأسيس-المشروع · **Date:** 2026-08-07
**Type:** Read-only pre-implementation investigation (no code exists yet)
**Language:** English (audience = agents, v3 §11)

**Mid-investigation course corrections folded in (both from the coordinator, 2026-08-07):**
1. **Zero cost, permanently.** No subscription, no card, no paid tier, no paid domain. Anything that can cost money at any point is disqualified. → §11
2. **The user has decided the game is PUBLIC** («عادي أي أحد يدخل اللعبة أبيه للعامة»), and the project is now named **«لعبة نوف»**. The published site therefore carries the real questions and their media. Free-tier caps are back on the critical path; bandwidth becomes the sleeper risk. → §12, §13, §14. **This decision is recorded, not re-argued.**

---

## 0. Method and honesty statement — read this before quoting any number

| What | Status |
|---|---|
| Platform limits (GitHub / Cloudflare / Netlify) | **Verified against official vendor documentation on 2026-08-07.** Every row carries its source URL. |
| Build/bundler behaviour (`base`, asset rewriting) | **Verified against official Vite documentation on 2026-08-07.** Stated as a constraint per stack family, not as a stack choice. |
| Response headers of a live GitHub Pages site (`Cache-Control`) | **NOT measured.** Best available evidence is a GitHub community discussion, not vendor docs. Marked `[UNMEASURED]` everywhere it appears, with the exact command the executor must run to convert it into a measurement. |
| Our bundle size, file count, request count | **NOT measurable today — no code exists.** §7 gives budgets to design against; §8 gives the procedure that produces the real numbers. |
| Anything about this machine | **Nothing was executed.** This investigation had read + web tools only, no shell. No claim in this report is presented as a local measurement. |

**Rule for everyone downstream:** the sentence "it should work on Pages" is not evidence. The only acceptable evidence is the §8 output line:
`built <hash> · served from /nouf-game/ · Chromium <ver> · N requests · 0 failed · X.X MB transferred · M files · largest file Y MB`.

---

## 1. The GitHub Pages contract — verified and dated

All rows accessed **2026-08-07**.

| # | Limit | Value | Hard or soft | What the user actually sees when he crosses it | Source |
|---|---|---|---|---|---|
| 1 | Single file, pushed via git | warning > **50 MiB**, **blocked > 100 MiB** | **Hard block** | `git push` rejected with an error; nothing is published. GitHub Desktop shows a red failure. | [about-large-files-on-github](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) |
| 2 | Single file, uploaded via the **browser** (drag-and-drop) | **25 MiB** | **Hard block** | The web UI refuses the file. The rest of the batch may upload, leaving a **half-published site** — the worst failure mode for a non-developer. | [adding-a-file-to-a-repository](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository) |
| 3 | Files per browser upload batch | **100 files at a time** | Hard | He has to repeat the drag several times, and can silently forget a folder. | same as #2 |
| 4 | Source repository size | recommended **≤ 1 GB**; **< 5 GB strongly recommended** | Soft (recommendation) | Slow clones/pushes; eventually email from GitHub. | [about-large-files-on-github](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) |
| 5 | **Published site size** | "Published GitHub Pages sites may be no larger than **1 GB**" | **Hard** (site may not be served) | Deploy fails or the site stops being served; GitHub emails the account. | [github-pages-limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| 6 | Bandwidth | **100 GB / month**, explicitly *soft* | Soft | Email from GitHub "suggesting strategies… including putting a CDN in front of your site… or moving to a different hosting service". Site normally keeps working. | same as #5 |
| 7 | Builds | **10 / hour**, *soft* (does not apply to custom Actions workflows) | Soft | A re-upload does not appear immediately. | same as #5 |
| 8 | Deployment timeout | **10 minutes** | Hard | Deploy marked failed; site stays on the previous version. Relevant only if the bundle is very large. | same as #5 |
| 9 | Rate limiting | HTTP **429** with an informative HTML body | Hard, transient | A guest in the majlis gets an error page instead of the game. Only reachable with abusive traffic. | same as #5 |
| 10 | HTTPS | Automatic for `*.github.io` sites created after **2016-06-15** | Given | Nothing to configure. Custom domains need "Enforce HTTPS" ticked manually. | [securing-your-github-pages-site-with-https](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https) |
| 11 | Mixed content | Any `http://` reference on an HTTPS page is blocked/degraded | Hard | Images/audio/video referenced by an `http://` link silently fail to load. **Directly relevant to open decision #2 (video by link).** | same as #10 |
| 12 | Plan requirement | On **GitHub Free**, the repository **must be public** | Hard | He cannot keep the repo private without paying. **Under the zero-cost constraint this is settled: the repo is public.** | [creating-a-github-pages-site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) |
| 13 | Site visibility | "GitHub Pages sites are **publicly available on the internet, even if the repository for the site is private**" | Hard, by design | Everything uploaded is public. **The user has chosen this deliberately (§14).** | same as #12 |
| 14 | Site count | One Pages site per repository; one user/org site per account | Hard | — | [about-github-pages](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages) |
| 15 | URL shape | User site `https://<owner>.github.io` · **Project site `https://<owner>.github.io/<repo>`** | Hard | This one line is the root of §2. | same as #14 |
| 16 | Server-side anything | None. No rewrites, no redirect config, no custom response headers, no server code | Hard | No `_headers`/`_redirects` support (those are Netlify/Cloudflare features). Caching is whatever GitHub sends. | derived from #5/#14 docs |

### The three findings that change the plan

1. **Row 2 (25 MiB via browser) is a stricter real limit than row 5 (1 GB site).** For a non-developer who uploads through the website, the binding constraint is 25 MiB per file and 100 files per batch — not 1 GB.
2. **Rows 12+13: the published game is public, and on a free account the repository is public too.** Under the zero-cost constraint there is no version of this where the repo is private. Factual consequences in §14.
3. **Row 11: `http://` media links are blocked.** If open decision #2 lands on "video by link", the link must be HTTPS. A plain `http://` direct video link will silently not play.

---

## 2. The sub-path trap — the number-one cause of "worked locally, broken live"

### 2.1 What actually breaks

The project site is served from `https://<owner>.github.io/<repo>/`, not from `/`. Every URL that starts with a leading slash therefore resolves one level too high:

| Source in the build | Resolves locally (`http://localhost:5173/`) | Resolves on Pages | Result |
|---|---|---|---|
| `<script src="/assets/index-a1b2.js">` | `/assets/index-a1b2.js` ✅ | `https://<owner>.github.io/assets/index-a1b2.js` | **404** |
| `<link href="/assets/index.css">` | ✅ | `…github.io/assets/index.css` | **404** |
| `fetch('/data/starter-pack.json')` | ✅ | `…github.io/data/starter-pack.json` | **404** |
| `<img src="/img/logo.png">` | ✅ | `…github.io/img/logo.png` | **404** |

**Repo-name note (new, from the rename to «لعبة نوف»):** a GitHub repository name may only contain `A-Z a-z 0-9 . _ -`. The repository — and therefore the sub-path in the URL — **must be Latin**, e.g. `nouf-game` → `https://<owner>.github.io/nouf-game/`. The Arabic title «لعبة نوف» lives in the page, the `<title>`, and the manifest — never in the URL.

### 2.2 How it manifests (so the reviewer recognises it instantly)

- **A completely white page**, no error visible to a non-developer.
- Console: `Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html"`. That is *not* a MIME-configuration bug — it is the 404 page (HTML) being returned in place of the JS file. Anyone who chases the MIME message instead of the URL loses an entire session.
- Worse variant: if the owner **also has a user site** at `<owner>.github.io`, the mis-rooted request returns **200 with the wrong content** from that other site. No 404 at all — just inexplicable behaviour. This is why the pass criterion in §8 is "zero failed requests **and** zero console errors", never "no 404s".

### 2.3 The fix, per realistic stack family

| Family | How the base path is set | Cost / caveat |
|---|---|---|
| **Raw HTML/CSS/JS, no build tool** | Discipline only: never a leading slash. Use `./assets/…`, `../`, or nothing. | Zero tooling. Fully path-agnostic by construction. The only enforcement is the §8 lint. |
| **Vite (any framework, or none)** — option A **recommended** | `base: './'` (or `''`) in `vite.config`. Docs: *"This will make all generated URLs to be relative to each file."* | Works at **any** path on **any** host with **no reconfiguration**: `/repo/`, root on Netlify/Cloudflare, a renamed repo, a nested folder. Requires `import.meta` support (all modern browsers). Dynamic URLs must be built with `import.meta.env.BASE_URL`, written **exactly as-is** — `import.meta.env['BASE_URL']` does **not** work. Forbids history-based routing at nested paths. |
| **Vite** — option B | `base: '/repo-name/'` | Exact and simple, but **hard-codes the repository name into the bundle**. Renaming the repo, moving to Cloudflare Pages (root path), or the user creating the repo under a different name than the instructions assume → total breakage, and he has no way to fix it. |
| **Meta-frameworks (Next/Nuxt static export)** | `basePath` / `app.baseURL` | Already rejected by the founding report for other reasons. Adds `_next/` — an underscore folder — making `.nojekyll` load-bearing (§2.5). |

**Ruling: use a relative base (`base: './'` for Vite, or plain relative paths for raw HTML), and no client-side router.**
Rationale, in order of weight:
1. The user may name the repository anything. A hard-coded base makes the delivered artefact depend on a choice he makes *after* we hand it to him. Unacceptable for a non-developer.
2. It keeps the Cloudflare-Pages/Netlify escape hatch usable with the **same, unmodified artefact** — no rebuild, no second version to maintain. **§13 turns this from a nicety into the project's bandwidth insurance policy.**
3. The game is a single screen. It needs no router at all. Hash routing would work if one were ever needed; history routing must be rejected (it requires a 404-fallback hack on Pages).

**Rejected: `base: '/repo/'`** — for reasons 1 and 2. **Rejected: history routing** — needs a `404.html` redirect trick, fragile and pointless for one screen.

### 2.4 What the bundler can and cannot rewrite — the classic trap

Vite rewrites "JS-imported asset URLs, CSS `url()` references, and asset references in your `.html` files". It cannot rewrite a string it does not understand:

| Reference form | Rewritten? | Verdict |
|---|---|---|
| `<img src="./logo.png">` in `index.html` | ✅ | Safe |
| `import logo from './logo.png'` | ✅ | Safe |
| `background: url(./logo.png)` in CSS | ✅ | Safe |
| `new URL('./logo.png', import.meta.url)` | ✅ | Safe — **this is the correct form for dynamic assets** |
| `fetch('/data/pack.json')` | ❌ | **404 in production** |
| `` fetch(`/media/${id}.png`) `` | ❌ | **404 in production** |
| Anything in `public/` referenced as `/logo.png` | ❌ (copied verbatim, string untouched) | **404 in production** — `public/` is the most common source of this bug |
| `navigator.serviceWorker.register('/sw.js')` | ❌ | **404, and wrong scope.** Must be `'./sw.js'` |

**Enforceable rule for the whole project: zero leading-slash URLs anywhere in source or output.** Machine-checkable (§8 step 4a); must be a build gate, not a review habit.

### 2.5 `.nojekyll` and underscore-prefixed names

- By default GitHub Pages runs the source through Jekyll, and **Jekyll does not build files or folders whose names start with `_`**. They vanish from the published site with no error at all.
- Adding an **empty file named `.nojekyll` at the root of the publishing source** bypasses Jekyll entirely and publishes the files as-is. ([about-github-pages-and-jekyll](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll), [configuring-a-publishing-source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) — accessed 2026-08-07)
- Bundlers do emit underscore names (Vite helper chunks such as `_plugin-vue_export-helper…`, Next's `_next/`). Live risk, not theoretical.
- **Two-layer rule, because `.nojekyll` itself is fragile in a non-developer's hands** (Windows Explorer hides dotfiles, some zip tools drop them, a web-UI drag can lose them):
  1. Always emit `.nojekyll` into the build output, and **assert its presence in the deployed listing** (§8).
  2. **Additionally forbid `_`-prefixed emitted names**, so that even if `.nojekyll` is lost during upload the site still works. Cost: one lint rule.
- Jekyll also skips `/node_modules` and `/vendor` by default — confirms the "silent omission" behaviour class.

### 2.6 Arabic file names in URLs — **forbid them outright**

**Ruling: every file and folder name in the published artefact must match `^[a-z0-9._-]+$` (lowercase ASCII).** Arabic belongs *inside* files, never in a name that becomes part of a URL.

| Risk | Mechanism | Failure look |
|---|---|---|
| **Unicode normalisation mismatch** | Arabic text can be byte-different while looking identical (NFC vs NFD; letters carrying hamza/madda have composed and decomposed forms). The name on disk, the name in git, and the string in the HTML can disagree byte-for-byte. HTTP matches bytes. | **404 on a file that is visibly right there.** Undiagnosable by eye — the most expensive failure class in this list. |
| **Percent-encoding** | `صورة.png` must travel as `%D8%B5%D9%88%D8%B1%D8%A9.png`. Correct only if every layer agrees on UTF-8. | Breaks when one layer uses a legacy code page. |
| **Windows toolchain mangling** | v3 §1 rule 4 already records this for the project: Arabic names through shell channels produce mangled paths. Git's `core.quotepath`, PowerShell encoding and zip tools all participate. | Names arrive on the host as `Ø§Ø³Ù….png`. |
| **The host's editor is a browser** | Media the host adds through the in-app editor must be stored under a **generated ASCII id** (UUID/hash), with the Arabic title kept as metadata inside the pack. Removes the whole class from the runtime path. | — |

This costs the user nothing: he types Arabic titles in the editor as normal; only machine-generated storage keys are ASCII.

---

## 3. Case sensitivity — the silent Windows→host break

### 3.1 The mechanism

| Layer | Behaviour |
|---|---|
| Windows NTFS (dev machine) | Case-**insensitive**. `Logo.PNG` opens `logo.png`. |
| Git on Windows | `core.ignorecase = true` by default. A rename that changes **only case** is not recorded. The repository keeps the **old** name while the developer's disk shows the new one. |
| GitHub Pages (host) | Case-**sensitive**. `Logo.PNG` ≠ `logo.png` → **404**. |

Net effect: the reference works on the dev machine forever and 404s live, with nothing in the local run hinting at it.

### 3.2 The point that decides the verification design

> **A local static server on Windows will NOT catch a case bug.** Serving the build from a sub-path on Windows still resolves the wrong case successfully.

The browser rehearsal in §8 is therefore **necessary but not sufficient**. Case correctness must be proven by a **static, case-sensitive string check**, not by loading the page. Any protocol that relies only on "we loaded it in Chromium and saw no 404" is blind to this entire class on this project's dev platform.

### 3.3 How to catch it automatically (all cheap, all deterministic)

| Check | What it does | Catches |
|---|---|---|
| **A. Referenced-vs-real audit** (primary) | Enumerate the real filenames in the build output as reported by the filesystem. Extract every relative path referenced from the emitted `.html`, `.css`, `.js`. Assert a **byte-exact, case-sensitive** match exists for each. | Every case mismatch, on Windows, with no server involved. |
| **B. Lowercase-only policy** | Assert every emitted name matches `^[a-z0-9._-]+$`. | Removes the case, Arabic-name and underscore classes in one rule. |
| **C. `git config core.ignorecase false`** in the game repo | Makes git record case-only renames. | Prevents repo/disk divergence. Caveat: surfaces pre-existing duplicate paths differing only in case — do it at repo creation, not mid-project. |
| **D. Duplicate-name-modulo-case scan** | Lowercase all tracked paths, look for duplicates. | Files that collide on a case-insensitive checkout. |

A + B are mandatory gates. C + D are one-time hygiene at repo creation.

---

## 4. Upload paths for a non-developer — honest comparison

Step counts are the actions **the user personally performs**, end to end. "First" = first ever publication; "Update" = publishing a new version later.

| Path | Steps (first / update) | Per-file cap | Practical total size | What goes wrong | Updates later | Media survives? |
|---|---|---|---|---|---|---|
| **A. GitHub web UI drag-and-drop** | **~7 / 3** — sign up · create repo · open repo · drag files · commit · Settings→Pages→pick branch · open URL | **25 MiB** | ~100 files per batch; several batches possible | ① Drags the **folder** instead of its **contents** → site lands at `/repo/dist/` and the root 404s. ② `.nojekyll` invisible in Explorer, lost in the drag. ③ A >25 MiB video is refused mid-batch → half-published site. ④ Deleting stale files later is painful (one at a time). | Drag the new files again; overwrites by name. Old orphan files are **not** removed. | Only if every file ≤ 25 MiB |
| **B. GitHub Desktop** | **~9 / 3** — install app · sign in · create repo via app · open the folder · copy files in · Commit · Publish · Settings→Pages · open URL. Update: copy files in · Commit · Push | **100 MiB** (git block) | Comfortably hundreds of MB | Installing a program; the word "commit"; the folder-vs-contents mistake still exists but is less likely. | Correct and complete: **handles deletions**, so no orphan files. Best update story of all GitHub options. | Yes, up to 100 MiB/file |
| **C. Zip that he extracts into a repo** | **B or A + 2** (download · extract) | inherits | inherits | Adds the **nested-folder trap** (`dist/dist/index.html`) — the most common non-developer failure — plus zip tools that drop dotfiles (`.nojekyll`). | inherits | inherits |
| **D. Netlify Drop** (`app.netlify.com/drop`) | **~3 / 1** — open the page · drag the folder · sign up to **claim** the site | not publicly documented — **do not rely on a number** | free plan bandwidth capped; **site suspended** for the rest of the month if exceeded | Unclaimed sites are deleted within about an hour. Random subdomain. Suspension on overage is harsher than GitHub's email. | Unknown per-file cap — must be measured before relying on it |
| **E. Cloudflare Pages direct upload** | **~5 / 2** — sign up · create project · choose direct upload · drag folder · open URL | **25 MiB** (documented) | **20,000 files** on free; **static requests and bandwidth free and unlimited** | Account creation is heavier than Netlify's. Same 25 MiB media cap as GitHub's web UI. | Drag again into the project. | Only if every file ≤ 25 MiB |

Sources accessed 2026-08-07: [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) · [Cloudflare Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/) · [Netlify Drop quickstart](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/) · GitHub rows as cited in §1.

### 4.1 Recommendation

**Primary: GitHub Pages, first upload through the web UI drag-and-drop (path A).**
It is what the user asked for, it installs nothing, and it is ~7 steps. **This imposes two hard build constraints the planner must adopt from day one:**
- **≤ 100 emitted files** in the published artefact (one drag suffices), and
- **no single file > 20 MB** (safely under the 25 MiB cap).

If the project violates them, the primary path escalates to **GitHub Desktop (B)** — an escalation, not a crisis. §12 shows the media budget is designed to keep A viable.

**Fallback: Cloudflare Pages (E)** — see §13 for why it, not Netlify, is the fallback under the public-game decision. Usable as a drop-in **because of the relative base in §2.3**: the identical, unmodified artefact works on both hosts.

**Two mitigations for the folder-vs-contents trap (pick one at planning time):**
1. Deliver a folder and instruct: *open it, select everything inside, drag that*. Zero extra concepts, relies on careful reading.
2. Deliver the build inside a folder literally named `docs`, and have him choose the Pages publishing source **"main branch, `/docs` folder"**. He drags the whole `docs` folder — no "select the contents" instruction, no nesting mistake possible. Cost: one extra dropdown choice. ([configuring-a-publishing-source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), accessed 2026-08-07)

Option 2 trades a fragile *instruction* for a reliable *setting*. **Recommended.**

---

## 5. Offline in the majlis

### 5.1 What actually happens today with no internet

**Without a service worker: no internet = no game.** The browser shows its own offline error page. The `max-age=600` HTTP cache (§6) can occasionally satisfy a reload within ten minutes of a prior load, but this is not dependable and must never be presented to the user as an offline story.

### 5.2 The architectural fact that makes offline cheap

Media the host authors himself lives in **his browser** (IndexedDB), placed there by the in-app editor — offline by construction. What needs the network is the **app shell** (HTML/JS/CSS/fonts/UI sounds), targeted at **≤ 1.5 MB transferred** (§7.2), plus any **published** pack media (§12). Making the shell survive offline is a small, well-understood job; making 200 MB of published media survive offline is not (§11.4).

### 5.3 Service worker + installable PWA — verdict: **worth it, with conditions**

| | Assessment |
|---|---|
| **Benefit** | After **one** successful online visit, the game shell opens and runs with no internet. Directly protects the declared success metric ("a full session in front of a group without breaking"). |
| **Cost** | Build-time precache list, a small `sw.js`, a `manifest.webmanifest`, icons: **≤ 60 KB**. Plus the discipline in §6.2. |
| **Prerequisite** | Service workers require HTTPS or `localhost`. GitHub Pages is HTTPS by default (§1 row 10). ✅ |
| **Scope trap** | Register as `navigator.serviceWorker.register('./sw.js')`. A leading slash gives a root scope the site does not own and 404s on a project site. |
| **Real risk** | A cache-first service worker is a **permanent-stale-version trap** on a host with no header control. The one way a service worker makes things *worse*. Mitigations in §6.2 are mandatory. |
| **PWA install** | `display: standalone` + icons gives a home-screen/desktop launcher with no address bar. For a shared screen driven by a non-technical host in front of guests, removing browser chrome is a real quality gain for near-zero cost. |
| **Scope limit (new, per §12)** | Precache **the shell only**, never the whole published media pack. Precaching 200 MB would blow storage quotas and make every update painful. Published media is cached opportunistically (runtime cache, LRU-capped) — so a question already shown once replays offline, but an unseen one may not. **State this honestly; do not promise full offline for published media.** |

**Honest statement of what will NOT work offline:** any question whose media is an **external link** (YouTube or a direct URL) will not play, ever. If open decision #2 lands on "link" or "both", the offline promise covers only local/published media, and the game must show a clear, calm message rather than a broken player. Decision input for `durability-advisor`; the measured cost is stated here, the choice is not mine.

### 5.4 Can he just run the bundle from a local folder (`file://`)? — **No** (expanded in §11.4)

| Blocker | Effect on `file://` |
|---|---|
| ES modules (`<script type="module">`) | Blocked by CORS. **The app never starts.** Default output shape of every modern bundler. |
| `fetch()` / `XMLHttpRequest` of local files | Blocked. Any data file load fails. |
| Service workers | Unavailable on `file://`. |
| IndexedDB / storage APIs | `file://` is treated as an opaque origin in Chromium; availability and persistence vary by browser. **The in-app editor — the core of the product — cannot be relied on.** Exact per-browser matrix is `media-storage-expert`'s call; the delivery-level conclusion does not depend on it. |
| Relative base (§2.3) | Helps with **path resolution only**. Removes one blocker out of four. |

**Ruling: `file://` is not a supported delivery mode.** Full re-examination as a *primary* path, as requested, in §11.4 — the ruling survives.

---

## 6. Caching and updates — not debugging a stale page in front of guests

### 6.1 Without a service worker

- `[UNMEASURED]` GitHub Pages is widely reported to send `Cache-Control: max-age=600` (10 minutes) with an `ETag`, and **response headers are not configurable on Pages** (no `_headers` file — that is a Netlify/Cloudflare feature). Evidence: [GitHub community discussion #11884](https://github.com/orgs/community/discussions/11884), accessed 2026-08-07. **Not a vendor-documented guarantee.**
- **Executor task, one command, converts this into a measurement:**
  `curl -sSI https://<owner>.github.io/<repo>/index.html` — record `cache-control`, `etag`, `age`, `content-type`. Repeat for one hashed asset. Put the real values into the protocol file.
- If 10 minutes holds, the news is **good**: the stale window after a re-upload is bounded, then the browser revalidates.
- **Hashed asset filenames** mean a new build's assets have new URLs, so a stale `index.html` can never be paired with new assets.
- **The one genuinely dangerous combination:** a stale `index.html` referencing assets the new upload **deleted**. Mitigation: on an update, do not delete the previous build's hashed assets (they are small); or accept and wait out the ten-minute window. `index.html` must **never** carry a hashed name.
- **Bandwidth bonus (relevant to §13):** with ETags, a returning visitor's requests return `304 Not Modified` with no body. Bandwidth is therefore driven almost entirely by **new** visitors, not repeat ones.

### 6.2 With a service worker — mandatory discipline

A service worker overrides HTTP caching, so staleness becomes **unbounded** unless handled. All of the following are required:

1. **Build-generated precache manifest** — the cache name must change on **every** build (content hash in the cache key). A fixed cache name is the classic permanent-stale bug.
2. **Auto-update on next load** — the new worker calls `skipWaiting()` + `clients.claim()`. For this user, silent auto-update beats an "Update available" button he might not understand.
3. **Never precache `index.html` cache-first without revalidation.** Network-first (or stale-while-revalidate) for the document; cache-first only for hashed assets, which are immutable by construction.
4. **A visible version string on the start screen** — e.g. `v1.4 · 2026-08-07`. The single cheapest anti-stale device that exists: it turns "is this the new version?" from a debugging session into a glance.
5. **One-line update instruction:** *after uploading, open the page and check the number at the bottom. If it is the old one, refresh once.* One step, no diagnosis.
6. **Never ship a service worker without §8 step 7** (offline verification) passing.
7. **Cap the runtime media cache** (per §5.3) so published media never fills the origin quota.

---

## 7. Size budget — a hard budget from day one

### 7.1 Which limit actually binds

The 1 GB published-site limit is **not** the first constraint hit. In order:

| Rank | Constraint | Value | Why it binds first |
|---|---|---|---|
| 1 | **Web-UI per-file cap** | **25 MiB** | One ordinary phone video exceeds it. |
| 2 | **Web-UI files per batch** | **100 files** | Reachable with an over-split bundle plus a media pack. |
| 3 | Bandwidth | 100 GB/mo | 100 GB ÷ per-visitor bytes = sessions/month (§13). |
| 4 | Git per-file hard block | 100 MiB | Only via the GitHub Desktop path. |
| 5 | Published site | 1 GB | Effectively unreachable if 1–3 are respected. |

### 7.2 Budget A — the app shell (always applies)

| Component | Budget (transferred, gzip/brotli) | Note |
|---|---|---|
| `index.html` | ≤ 10 KB | never hashed |
| App JS | ≤ 350 KB | one or two chunks, not many |
| CSS | ≤ 50 KB | |
| Arabic fonts (2 weights, woff2, **subset**) | ≤ 250 KB total | unsubsetted Arabic woff2 typically runs 100–150 KB per weight — **must be measured, not assumed**; `rtl-stage-ux-expert` owns the choice, this row owns the ceiling |
| UI icons (SVG) | ≤ 50 KB | |
| UI sounds (correct / wrong / win) | ≤ 300 KB | 3–5 short clips |
| Service worker + manifest + icons | ≤ 60 KB | |
| **Total shell (transferred)** | **≤ 1.5 MB** | 0.15 % of the 1 GB limit |
| Total shell on disk | ≤ 5 MB | |
| **Emitted code-file count** | **≤ 40** | leaves ≥ 60 of the 100-file batch for media |
| **Largest shell file** | **≤ 2 MB** | vs. the 25 MiB cap |

Consequences: a cold shell load on 2 Mbps ≈ **6 seconds**. One drag, one batch, no file refused.

### 7.3 Budget B — superseded by §12

Budget B in the original draft assumed media might be published. **That is now the settled case, so the authoritative media budget is §12.** §7.3 is retained only as the derivation of the per-item caps §12 uses.

### 7.4 The video verdict (numbers only — the decision is not mine)

| Clip | Typical size | Verdict |
|---|---|---|
| 30 s, 720p, H.264 | 5–20 MB | ✅ fits under the 25 MiB web-UI cap |
| 60 s, 1080p | 25–60 MB | ❌ refused by the web UI; needs GitHub Desktop |
| 3 min, 1080p, straight off a phone | 60–150 MB | ❌ may exceed the **100 MiB git hard block** entirely |

**Rule: no single media file over 20 MB may enter the published bundle.** Video is the only asset class in this project capable of breaking a platform limit. These measured costs go to `durability-advisor` for open decision #2. I supply numbers; I do not choose.

---

## 8. The verification protocol — proving it works BEFORE he uploads

**Candidate protocol file: `docs/بروتوكولات/build-and-serve-at-subpath.md`** (v3 §8; English content, Latin filename). To be written by whoever first executes it, with the real measured numbers filled in. Companion: `playwright-live-check.md`.

### Preconditions (v3 §1)
Isolated git worktree with its own `node_modules`. A dedicated port from the reserved range **3010+ (never 3000)**, assigned in the executing agent's prompt. Kill only PIDs you created; verify the port is free before handing back.

### Steps

| # | Step | Pass criterion |
|---|---|---|
| 1 | Delete the output directory. Clean production build. | Build exits 0 |
| 2 | **Stage a sub-path**: create `verify/nouf-game/` and copy the **entire** build output into it. | The app under test is served from `/nouf-game/` — an honest rehearsal of `<owner>.github.io/<repo>/` |
| 3 | Assert `.nojekyll` exists inside the copied output. | present |
| 4a | **Leading-slash scan** of every emitted `.html`/`.css`/`.js` for `src="/`, `href="/`, `url(/`, `from "/`, `import("/`, `fetch("/`, `register("/`, and protocol-relative `//`. | **0 hits** |
| 4b | **Name policy scan**: every emitted file and folder name matches `^[a-z0-9._-]+$`, and none starts with `_`. | **0 violations** (covers §2.6 and §2.5) |
| 4c | **Case audit** (§3.3-A): every referenced relative path has a byte-exact, case-sensitive match on disk. | **0 mismatches** — *the only check that catches case bugs on Windows* |
| 4d | **Budget audit**: emitted file count, largest single file, total on-disk size. | ≤ 100 files · ≤ 20 MB largest · ≤ §12 budget. **Report all three numbers.** |
| 5 | Serve `verify/` as the server root on the reserved port with a **plain static file server** — no SPA fallback, no dev server, no HMR. URL under test: `http://127.0.0.1:<port>/nouf-game/` | server up |
| 6 | **Playwright, real Chromium**, fixed viewport (shared-screen size, e.g. 1920×1080, `deviceScaleFactor: 1`). Listen on `response`, `requestfailed`, `console`, `pageerror`. Navigate, wait for network idle, then exercise the primary path: start a game, display one question of **each** media type (text/image/audio/video), answer, advance the maze. | **0 responses with status ≥ 400 · 0 `requestfailed` · 0 console errors · 0 `pageerror`.** Record total requests and total transferred bytes. Fixed-viewport screenshot. |
| 7 | **Offline check** (if a service worker ships): after one successful online load, `context.setOffline(true)`, reload, replay the primary path. | Shell loads and plays. Externally-linked media is expected to fail **gracefully with a message** — record which. |
| 8 | **Update check**: normal reload and hard reload both pass; the on-screen version string matches the build. | match |
| 8b | **Local-pack check** (§11.3): import a pack file through the file input, confirm image/audio/video from the pack render and play, reload, confirm it persisted. | pass |
| 9 | Kill the server. Verify the port is free. | free |

### Report line (the only accepted form of "it works")

```
built <hash> · served from /nouf-game/ · Chromium <ver> · N requests · 0 failed
· X.X MB transferred · M files · largest file Y MB · offline: pass/n-a · version string: vZ
```

### Explicitly rejected as evidence
`file://` · the dev server · serving at the root path · "the screenshot looks fine" · "it worked on localhost" · a passing local run used to claim case correctness (§3.2).

---

## 9. Remaining risks, stated plainly

| # | Risk | Severity | Mitigation / owner |
|---|---|---|---|
| 1 | Published content is public and the free-plan repo is public (§1 rows 12–13). | **Decided by the user** | Facts on record in §14. Not re-argued. |
| 2 | `Cache-Control` on Pages is `[UNMEASURED]`. If much longer than 600 s, the stale window in §6.1 grows. | Medium | One `curl -I` by the executor (§6.1). |
| 3 | Netlify's per-file deploy cap is **not publicly documented**; its free-plan model changed to credits. | Medium | Demoted to third choice (§13.3). Do not promise it. |
| 4 | The folder-vs-contents drag mistake (§4) — most likely single point of failure for this user. | **High — human** | Adopt the `/docs` publishing-source option (§4.1 mitigation 2). |
| 5 | A service worker without §6.2 discipline becomes a permanent stale-version trap on a host with no header control. | High if mishandled | §6.2 mandatory; §8 steps 7–8 gate it. |
| 6 | Case bugs are invisible to every check that runs on Windows except §8 step 4c. | High | Make 4c a build gate, not a review step. |
| 7 | Externally-linked media breaks the offline promise and, if `http://`, is blocked as mixed content (§1 row 11). | Medium | Input to open decision #2; HTTPS-only links if chosen. |
| 8 | **Bandwidth**, now that the game is public and shareable (§13). | **Medium, and it is the sleeper** | Lazy media + `preload="none"` (§12.3); Cloudflare Pages as the pre-planned escape (§13.3). |

---

## 10. Constraints this investigation places on the stack choice (not a stack choice)

1. Must support a **relative base** (`./`) so the artefact is path-agnostic. (Vite: documented. Raw HTML: by construction. Meta-frameworks: awkward — another reason to keep them rejected.)
2. Must **not** require history-based client-side routing. No router is the preferred answer.
3. Must emit **≤ 100 files** and **all-lowercase ASCII names**, with **no `_` prefixes**.
4. Must emit `.nojekyll` into the output.
5. Must allow the app shell to stay **≤ 1.5 MB transferred**.
6. Must allow a build-time-generated service-worker precache manifest whose cache name changes per build, **scoped to the shell only**.
7. Must support loading a question pack **from a user-selected local file at runtime** (§11.3) as a first-class code path in the same build.

---

# 11. The zero-cost constraint (course correction 1)

## 11.1 Free tiers, verified — and can a bill ever appear?

All accessed **2026-08-07**.

| Host | Free static hosting? | Bandwidth on free | Site/file caps on free | What happens at the cap | Card required to sign up? | **Can a bill appear?** |
|---|---|---|---|---|---|---|
| **GitHub Pages** | Yes, on **GitHub Free** — but **the repository must be public** ([creating-a-github-pages-site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)) | **100 GB/month, explicitly soft** | Site ≤ 1 GB · file ≤ 100 MiB (git) / 25 MiB (web UI) · 10 builds/hour soft | **Email from GitHub** suggesting a CDN or another host; GitHub "may be unable to serve the site"; possible HTTP 429. **No metered charging exists for Pages.** | **No** | **No.** There is no usage-based billing path for Pages. Overage is handled by email and throttling, never by invoice. |
| **Cloudflare Pages** | Yes | **"requests to static assets are free and unlimited"** — on **both free and paid plans** ([Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)) | **20,000 files** · **25 MiB per file** · 500 builds/month · 1 concurrent build ([Pages limits](https://developers.cloudflare.com/pages/platform/limits/)) | File-count/file-size caps are refusals at deploy time, not charges. | **No** (free plan) | **No — provided Pages Functions are never used.** Functions requests count against the Workers quota. **We use zero Functions** (pure static), so the metered surface is empty. |
| **Netlify** | Yes | Free tier is capped; the plan model moved to a **credit** system (pricing page shows a "300 credit limit") — the older documented figure was 100 GB/month | Not clearly documented per-file for standard deploys; 54,000 files per directory | Community/vendor material states an over-limit site is **suspended for the remainder of the calendar month**, reactivated by upgrading to a **paid usage-based plan** | Not verified | **Not proven impossible.** The recovery path from a cap is explicitly "upgrade to a usage-based plan". Under a zero-cost-forever rule this is a **disqualifying shape**, even if no charge occurs automatically. |

**Ruling under zero cost:** GitHub Pages and Cloudflare Pages both satisfy "free forever, no card, no bill possible". **Netlify is demoted to third** — not because it charges, but because its documented failure mode at the cap is *site down + upgrade prompt*, which is exactly the pressure the constraint forbids, and its free-tier numbers are currently in flux.

**Custom domain:** disqualified. A domain is a recurring purchase. The address stays `https://<owner>.github.io/nouf-game/` (free, HTTPS automatic) or `<project>.pages.dev` on Cloudflare (free, HTTPS automatic). Neither costs anything ever.

## 11.2 The real price of free

The price is not money; it is that **the published files are downloadable by anyone who has the URL, on every free static host without exception**. Free static hosting has no access control — that is what makes it free. GitHub Free adds a second layer: the *repository* is public too, so the file list is browsable, not just the served site. The user has been told this and has decided (§14).

## 11.3 The "engine public, pack local" architecture — my verdict

The coordinator asked for a verdict, not agreement. **Verdict: technically sound, and it must be built regardless of the public/private decision — but it is no longer the primary delivery mode.** The user's public decision (§14) means published packs also exist. The two coexist; here is the assessment on its own merits.

**How it works:** the site ships the engine (code, fonts, UI, no personal media). At play time the host loads a question pack from his own device.

| Question | Answer |
|---|---|
| **Does loading a local media pack hit a browser restriction?** | **No — via `<input type="file">` (or drag-and-drop onto the page).** The user picks the file; the browser hands back a `File`; `URL.createObjectURL(file)` produces a URL that `<img>`, `<audio>` and `<video>` accept. No CORS, no permission prompt beyond the picker, works in every browser, works on HTTPS and on `file://`. This is the reliable path. |
| **What must be avoided** | The **File System Access API** (`showOpenFilePicker`, directory handles) is **Chromium-only** — not in Firefox or Safari. Acceptable as a progressive enhancement (it can remember the file between sessions); never as the only path. |
| **Size ceiling** | Selecting a large pack is fine, but reading a 200 MB file with a naive `readAsArrayBuffer` will strain a low-end laptop. The pack must be read **incrementally / streamed**, with media extracted to IndexedDB or served as object URLs on demand. **Format and streaming strategy belong to `media-storage-expert`; I state only the delivery constraint: one single file, ASCII name, streamable.** |
| **What the host physically does at the start of the majlis** | Open the game URL → tap **«افتح ملف اللعبة»** → pick the pack from the laptop → play. **2 taps.** If he played on this device before and the pack is in IndexedDB, **0 taps** (it auto-loads and he presses Start). |
| **Cost on a different device** | He must carry the pack file — USB stick, email to himself, cloud drive — then repeat the 2 taps. **This is the whole reason the pack must be ONE file.** If media lived as a loose folder he would be carrying a directory around, and would inevitably move only some of it. |
| **Where it breaks** | ① If the pack is not a single file. ② If it relies on the Chromium-only API. ③ If a huge pack is read into memory at once. ④ If the host clears browser data and has no exported copy — the durability risk `durability-advisor` already owns. ⑤ On `file://` (§11.4), persistence is unreliable, so he re-picks the file every single time. |

**Can both modes coexist in one bundle without complicating the build? — Yes, plainly.**
The engine reads its pack through a single loader with an ordered source list: (1) a pack the user imported, held in IndexedDB; (2) a pack file the user just picked; (3) the bundled published pack shipped with the site. That is one runtime abstraction and **one build**, not a build variant, not a config flag, not two artefacts. The relative-base ruling (§2.3) is untouched. **No build complication. Recommend building it this way from the first version.**

Under the public decision, this path is re-framed exactly as the coordinator proposed: it is (a) how the author builds a game and moves it between his own devices, and (b) how **any visitor** can author and play his own game without publishing anything. Both are real product value, independent of privacy.

## 11.4 `file://` re-examined as a **primary** path — the ruling survives

Asked as a first-class mode rather than an afterthought, here is the full answer.

**A `file://` build is technically possible only under all of these conditions simultaneously:** a single fully-inlined `index.html`, classic (non-module) scripts, zero `fetch`, and the pack loaded exclusively through a file picker with object URLs. Under those conditions media does play from `file://` — object URLs from a picked `File` are unaffected by the `file://` restrictions.

**What it costs, honestly:**

| Cost | Detail |
|---|---|
| **A second build variant** | Breaks the one-artefact rule (§2.3 reason 2), doubles the §8 verification matrix, and creates a "which copy is he running?" support problem — for a user who cannot diagnose either. |
| **No service worker, no PWA, no install** | The offline story that costs him 0 steps is unavailable in the very mode chosen for offline. |
| **No code splitting, inlined everything** | Every asset base64-inlined into one HTML: roughly **+33 % size** and a single blocking parse. |
| **Unreliable persistence — the disqualifier** | IndexedDB on `file://` is opaque-origin in Chromium and varies elsewhere. Authoring work could silently fail to save. Making the **editor** — the core of the product — run on a surface where saving is not guaranteed is not an acceptable trade for a user whose entire question library is at stake. |
| **He re-picks the pack every session** | 2 taps become 2 taps *every time*, with no memory. |

**Ruling: reject `file://` as a delivery mode, primary or secondary.** The need it addresses — "works with no internet at all" — is better served by the **PWA (§5.3)** at a cost of **0 extra steps** for the user after the first visit, on the same single artefact, with reliable storage. If the user later insists on a truly disconnected laptop copy, revisit then with this cost table on the table; do not build it speculatively.

---

# 12. Media budget for a publicly-published game (course correction 2)

The published site now carries the real questions and their media. The caps in §1 are live.

## 12.1 The hard numeric budget

**Ceiling: 300 MB published site. Flag and stop at 200 MB.**
Not 1 GB. Rationale, each a measured or documented constraint: upload time on a home connection (300 MB at 10 Mbps upload ≈ **4 minutes**, against a **10-minute deploy timeout**), repository clone weight, the 100-file web-UI batch, and the bandwidth model in §13.

What fits inside 200 MB, with the app shell included:

| Class | Encoding target | Per item | Count | Subtotal |
|---|---|---|---|---|
| App shell (§7.2) | — | — | — | **5 MB** |
| Text-only questions | JSON | ~2 KB | 300 | 0.6 MB |
| **Image** questions | WebP, 1600×900, quality ~75 | **250 KB** | **200** | **50 MB** |
| **Audio** questions | m4a/mp3 ~96 kbps mono, ≤ 30 s | **360 KB** | **100** | **36 MB** |
| **Video** questions | mp4 H.264 **720p ~2 Mbps**, ≤ 20 s | **5 MB** | **20** | **100 MB** |
| | | | **620 questions** | **≈ 192 MB** |

**The single number the planner needs: video is ~19 MB per minute at 720p/2.5 Mbps, and ~30 MB per minute at 1080p/4 Mbps.** So:

| Video allowance | 720p minutes | 1080p minutes |
|---|---|---|
| 100 MB (recommended) | **≈ 5.3 min total** | ≈ 3.3 min |
| 150 MB (flag) | ≈ 8 min | ≈ 5 min |
| 250 MB (ceiling, other media squeezed) | ≈ 13 min | ≈ 8 min |

Read that as: **the whole published game gets about five minutes of video, total, across every question.** Images and audio are effectively unconstrained at these counts — 200 images and 100 audio clips cost less than one minute of 1080p video. **Video is the only class that can break anything.**

## 12.2 What the user actually experiences at each cap — and the answer to "can I be billed?"

| Cap crossed | What he sees | Site down? | **Bill?** |
|---|---|---|---|
| File > 25 MiB via web UI | The browser refuses that file; the rest may still upload → **half-published site** | Partially broken — the worst case | **Never** |
| File > 100 MiB via GitHub Desktop | Push rejected with an error; nothing published | No (old version stays) | **Never** |
| > 100 files in one drag | Only the first 100 land; he must repeat | Partially broken until he repeats | **Never** |
| Published site > 1 GB | Deploy fails or the site stops being served; **email from GitHub** | Yes, eventually | **Never** |
| > 10 builds/hour | The update simply does not appear yet | No | **Never** |
| Deploy > 10 minutes | Deploy marked failed; previous version stays live | No | **Never** |
| **> 100 GB bandwidth/month** | **Email from GitHub** suggesting a CDN or another host; possibly HTTP **429** pages for some visitors. Soft — the site usually keeps serving. | Rarely, and not immediately | **Never — there is no metered billing for GitHub Pages and no card on file.** |

**An unexpected charge is structurally impossible on GitHub Pages and on Cloudflare Pages without Functions.** That is the direct answer to the zero-cost constraint: the worst financial outcome is zero, in every scenario above. The worst *operational* outcome is an email and a migration.

## 12.3 The engineering requirement that makes the bandwidth budget work

**Mandatory in the build, not optional:**
- `loading="lazy"` on images; media fetched **only when its question is shown**.
- **`preload="none"` on every `<video>` and `<audio>`.** Without this, a browser may pull megabytes for questions nobody reaches. This single attribute is the difference between a 485-session ceiling and a 10,000-session ceiling (§13.1).
- No "preload the whole pack" convenience feature. Ever.
- Service worker runtime cache for media, **LRU-capped** (§5.3) — never precached wholesale.

---

# 13. Bandwidth — the sleeper risk of a public, shareable game

## 13.1 The model

Bandwidth ≈ **(new visitors) × (bytes each actually loads)**. Returning visitors are nearly free: hashed assets revalidate to `304 Not Modified` with no body (§6.1).

Assume the §12.1 pack (192 MB published) and a session in which a group plays ~20 questions:

| Scenario | Bytes per visitor | Sessions before 100 GB |
|---|---|---|
| Shell only, no media viewed | 1.5 MB | ≈ 68,000 |
| **Typical session, lazy media, `preload="none"`** | **≈ 10 MB** (shell + ~20 media items) | **≈ 10,200 / month** |
| Someone browses every question | ≈ 192 MB | ≈ 530 / month |
| **Eager preloading (the bug we forbid in §12.3)** | ≈ 192 MB for everyone | **≈ 530 / month** |

**Concrete WhatsApp scenario:** the link is shared into family groups and **1,000 different people** open it and play one session each → **1,000 × 10 MB = 10 GB**. That is **10 % of the monthly allowance.** The game would need roughly **10,000 distinct sessions in one calendar month** to hit the soft limit. For a family game that is comfortable headroom — but it is not infinite, and it is genuinely reachable if the link ever escapes the family.

## 13.2 What precisely happens at 100 GB on a free GitHub account

The limit is documented as **soft**. GitHub's stated response: it "may be unable to serve the site", or it contacts the account holder by email "suggesting strategies for reducing your site's impact on our servers, including putting a third-party content distribution network (CDN) in front of your site, making use of other GitHub features such as releases, or moving to a different hosting service." Separately, rate limiting can return **HTTP 429 with an informative HTML body**. ([github-pages-limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), accessed 2026-08-07)

In plain terms: **an email and possibly some visitors seeing an error page. Not a bill, not an instant shutdown.** The remedy GitHub itself names — move the site — is exactly what §13.3 pre-plans.

## 13.3 The comparison on this specific axis, and the fallback ruling

| Host | Static bandwidth on free | Behaviour at the ceiling |
|---|---|---|
| **GitHub Pages** | 100 GB/month, **soft** | Email; possible 429; usually keeps serving |
| **Cloudflare Pages** | **"requests to static assets are free and unlimited"**, on free and paid alike ([Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/), accessed 2026-08-07). All plans include "unlimited sites, seats, requests, and bandwidth" for static assets. | **There is no bandwidth ceiling to hit.** The binding caps are 20,000 files and 25 MiB per file. |
| **Netlify** | Capped; credit-based model in flux | Site **suspended** for the rest of the month; recovery path is upgrading to a paid usage-based plan |

**Ruling: fallback = Cloudflare Pages, and it is pre-planned rather than reactive.**
Cloudflare is materially different on precisely the axis that is now the sleeper risk: for a static site it has **no bandwidth limit at all**, on the free plan, permanently. Its per-file cap (25 MiB) is identical to GitHub's web UI, and its 20,000-file limit is two orders of magnitude above our ≤ 100-file budget. Because of the relative base (§2.3), migrating is **drag the same folder into a Cloudflare Pages project — no rebuild, no config change, ~5 steps once**. The URL changes to `<project>.pages.dev` (root path, so the sub-path trap disappears entirely).

Trigger to migrate, written down now so nobody improvises later: **an email from GitHub about bandwidth, or a measured month above 50 GB.**

**Netlify: demoted to third and not recommended** — suspension plus an upgrade prompt is the wrong failure shape under a zero-cost-forever rule.

## 13.4 Should we just start on Cloudflare Pages?

Honest answer: on bandwidth alone, yes. But the user asked for GitHub Pages, GitHub's web-UI drag-and-drop is the fewest-steps first publication for someone with no account anywhere, and the migration cost is genuinely ~5 steps with the same artefact. **Recommendation: start on GitHub Pages as he asked; keep Cloudflare Pages documented as the one-page migration.** If the planner wants to present it as a live choice, the honest framing is in the deck below.

---

# 14. "Public" — the concrete facts, for the record

The decision is made. These are the facts, without argument.

- **The site.** `https://<owner>.github.io/nouf-game/` is an ordinary website: any search engine may crawl and index it, and its files are downloadable by anyone with a URL. Indexing can be **reduced** for free by shipping a `robots.txt` with `Disallow: /` and a `<meta name="robots" content="noindex">` in the page. Both cost nothing and ship inside the bundle. **They reduce search visibility only; they do not restrict access.** Anyone given the link still gets everything.
- **The repository.** It is public (required by GitHub Free — §1 row 12). Anyone visiting it can browse the complete file list and download any file directly. GitHub's own `robots.txt` discourages search engines from indexing repository **code** paths ([community discussion #20958](https://github.com/orgs/community/discussions/20958), accessed 2026-08-07), so the repo is unlikely to surface in a Google search — but it is fully browsable to anyone who goes there. **There is no free setting that makes a public repository non-browsable;** privacy requires a paid plan.
- **URL guessing.** Media filenames are ASCII hashes/ids (§2.6), so guessing an individual file's URL is impractical. This provides no real protection, because the repository's file listing makes guessing unnecessary.
- **Deleting a file later.** Removing a file and re-uploading removes it from the **published site** on the next deploy. It does **not** remove it from **git history** — the old commit still contains it and it remains downloadable at that commit's URL. Truly erasing it requires rewriting history and force-pushing, or deleting the repository. And once a file has been fetched by a search-engine cache, a third-party archive, or any visitor, it is beyond anyone's control.
- **Practical consequence for the plan:** treat every published media file as permanent and public from the moment it is uploaded. This is a reason to keep the *authoring* workflow local (§11.3) — the author decides deliberately which packs get published, rather than everything he ever makes being published by default.

---

# For the user-facing deck

*(English here; the coordinator renders these in Arabic. The user's decision is no longer "which host" — it is **"what, if anything, leaves my laptop"**. Each item is a plain consequence with numbers and the count of steps he personally performs.)*

## The one real question: what leaves your laptop?

The game has two ways to hold questions, and **both work in the same package, with no extra cost and no second version**:

| Mode | Who can see it | What you do | Steps |
|---|---|---|---|
| **A. Published with the game** — the questions and their media are part of the site | **Everyone.** Anyone with the link plays it immediately, exactly as you asked | You upload once | **7 steps** the first time, **3** per update |
| **B. Kept on your device** — the questions live in a single game file you own | **Only you**, until you send the file to someone | At the majlis: open the game → «افتح ملف اللعبة» → pick the file | **2 taps** — and **0** if you already played on that device |

**Recommendation: build both, use both.** Mode A is the public game you decided on. Mode B is how you build a game, carry it to another laptop, and how any guest can make his own game without publishing anything.

## 1. Where it is published, and that it is free forever

**GitHub Pages**, as you asked. Free with no credit card, and there is **no way for a bill to reach you** — GitHub has no charging mechanism for this at all. If you ever exceed a limit, GitHub sends an **email**; it never sends an invoice. The address is `https://<yourname>.github.io/nouf-game/`. A prettier custom address costs money every year, so we are not using one.
**Your steps: about 7 the first time, about 3 for each update.**

## 2. Public means public — the facts, since you have chosen it

Anyone with the link opens and plays. Anyone who wants to can also download the images, audio and video inside the game. The code repository is public too (that is the price of the free plan) and its file list is browsable. We will add the free "please don't index this" settings so it is unlikely to show up in Google searches — but that reduces *finding* it, not *access* to it.
**One thing to know:** deleting a file later removes it from the site, but a copy stays in the upload history unless the whole repository is deleted. **Treat anything you upload as permanent.**
**Your steps: 0 — this is already handled in the package.**

## 3. Your media budget — the only number that can actually break something

| | Fits comfortably |
|---|---|
| Image questions | **200** |
| Audio questions (30 seconds each) | **100** |
| **Video** — the whole game, all questions combined | **about 5 minutes total** |

Images and audio are effectively free: 200 pictures and 100 sound clips together weigh less than **one minute** of video. **Video is the only thing that can break a limit.** Keep clips to **20–30 seconds**. A single file over **25 MB** cannot be uploaded through the website at all — a one-minute high-quality video is already over that.
If you ever need bigger videos: installing one extra program (GitHub Desktop) raises the per-file limit from 25 MB to 100 MB. **+2 steps, once.**

## 4. How many people can play before anything happens

The free allowance is 100 GB of traffic a month. A person playing one full session uses about **10 MB**. So:

- **1,000 people play once → 10 GB → 10 % used.**
- You would need roughly **10,000 sessions in a single month** to reach the limit.

If you ever did: GitHub sends **an email**, some visitors might briefly see an error page, and **you are never charged**. The fix takes about **5 steps once**: move the exact same package to Cloudflare Pages, which is also free and has **no traffic limit at all**. We will write that page down in advance so it is never an emergency.

## 5. Playing with no internet in the majlis

As things stand, no internet means no game. We can make the game itself keep working offline for about **60 KB** of extra weight. The condition costs you **1 step**: **open the game once while you still have internet** — ideally the day before. After that it opens with the internet off.
**Honest limits:** videos published on the site may need internet the *first* time each one is played; a video that is only a **link** (YouTube, for example) will never work offline. Questions loaded from your own game file (mode B) always work offline.

## 6. Bonus of the same feature: it looks like a real app

The game can be added to the screen's home page and open with no browser address bar — cleaner in front of guests. **1 step, once.**

## 7. After you upload a new version, it may show the old one for up to 10 minutes

That is the host's caching and cannot be switched off. So we print a **version number on the start screen**. Your whole instruction is one line: *look at the number; if it is the old one, refresh once.* **1 step, only when it happens.**

## 8. The habit you must not skip

Questions you create in the editor live **in your browser**, not on the site. A new device, or clearing browser data, erases them. **Export the game file and keep a copy** — on your phone, emailed to yourself, anywhere. **1 step after each editing session.** It is also the file you carry to another laptop, and the file you send to anyone who wants your game. This is the single most important habit in the whole product, and it is being examined separately as its own decision.

## What we are NOT doing, and why (so nobody proposes it later)

| Rejected | Reason |
|---|---|
| A paid custom domain | Costs money every year. Disqualified by your rule. |
| Netlify | Free, but when a limit is hit it **takes the site down** and asks you to upgrade to a paid plan. Wrong shape for "free forever". |
| A private repository | Requires a paid plan. And you have chosen public anyway. |
| **A copy that runs from a folder on the laptop with no website at all** | Technically possible, but the editor **cannot reliably save your questions** in that mode — you could lose your work. The offline feature in item 5 gives you the same benefit safely, and costs you 0 extra steps. |
