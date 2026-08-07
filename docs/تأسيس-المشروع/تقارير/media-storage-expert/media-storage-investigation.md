# Media & Browser-Storage Investigation — «لعبة نوف»

**Agent:** `media-storage-expert` · **Track:** تأسيس-المشروع · **Date:** 2026-08-07
**Type:** Pre-implementation, read-only investigation. No product code exists yet.
**Language:** English (v3 §11 — audience is agents; المنسِّق translates for the user).

**Revision history:**

| Rev | Change |
|---|---|
| v1 | Original six questions |
| v2 | Folded in **zero cost, permanently** |
| v3 | "The game is public, media ships with the site" |
| v4 | Re-scope: "engine only; pack uploaded at play time; nothing stored" |
| **v5 (this file)** | **Reverts v4 and cancels video.** The host **authors the whole game before the event and publishes it**; on the night he opens the link and plays. **Media types are text, image and audio only.** The save-to-computer export is kept, now as **backup and device-transfer**, not delivery. |

**On cancelled material (v3 §9.5):** nothing is erased. Superseded sections are struck, labelled, and summarised in **Appendix A** with a pointer to what replaced them. **Appendix C** collects every video-dependent finding, struck but preserved, so that reversing the video decision later costs a read rather than a re-investigation.

---

## 0. The settled model

| Phase | What happens | Where media lives |
|---|---|---|
| **Authoring** (days before) | The host writes questions and adds media in the in-app editor | IndexedDB draft on his machine |
| **Publishing** (once, before the event) | He exports a folder and uploads it to GitHub Pages via the browser | Ordinary static files on the public site |
| **Playing** (the night) | He opens the link. Everything is already there | Served over HTTP; **no browser storage needed by anyone playing** |
| **Backup / another device** | He saves a single `.zip` pack to his computer, and can re-import it to continue authoring elsewhere | A file he controls |

**Media types: text, image, audio. No video.** (User: «ألغِ فكرة الفيديو».)

---

## 1. What cancelling video removes — stated explicitly

This is the largest simplification the project has had. Six things stop being problems:

| Removed risk | Why it is gone | Where it is preserved |
|---|---|---|
| **The HEVC/codec trap** — iPhone records HEVC by default; Chrome on Windows shows a black rectangle without a hardware decoder and paid OS extensions | No `<video>` element exists. Audio codecs (MP3/AAC) have **no equivalent trap** — they are universally decodable | Appendix C.1 |
| **HTTP Range / `206` dependency** — Safari refuses to play `<video>` at all if the server does not answer Range requests | Downgraded from **blocking** to **negligible** — see §9 | Appendix C.2 |
| **The 100 MB per-file wall** | The largest file in the product is now a **2 MB** audio clip — **50× under the wall**, and 12.5× under the tighter 25 MiB web-upload cap that actually binds (§7.2) | Appendix C.3 |
| **Video memory blow-up mid-question** — a decoder DPB at 30–60 MB per element, 1.2–2.4 GB if elements leak across 40 questions | An `<audio>` element has no picture buffer. Live memory for a whole session now sits in the **single-digit MB**. This was the top technical risk in the project; **it no longer exists** | Appendix C.4 |
| **The whole `MB/min` bitrate budget and per-video ceilings** | Nothing in the product is measured in Mbps any more | Appendix C.5 |
| **In-browser transcoding as a v2 question** | Moot | Appendix C.6 |

**One thing survives from the video work and still matters: the autoplay policy** — it applies to `<audio>` exactly as it did to `<video>` (§5.3).

---

## 2. Browser storage during authoring

### 2.1 The store

**IndexedDB, for metadata and blobs together, one transaction per question.** Universal support; Chrome stores Blobs **by reference**, not in the JS heap. OPFS (Chrome ~101+, Safari 15.2+, Firefox 111+ — [web.dev](https://web.dev/articles/origin-private-file-system), accessed 2026-08-07) wins only for streamed writes of very large files, which no longer exist here. Cache API has no transactions or indexes. **`localStorage` never holds media** — ~5 MiB, synchronous, string-only.

Caveat kept on the record: Safari's IndexedDB historically could not store Blobs (evidence ~2015–2016, [state-of-binary-data](https://github.com/nolanlawson/state-of-binary-data-in-the-browser/blob/master/README.md)) — **unverified for Safari 17/18**; and it is a known bug in **iOS Safari Private Browsing** ([WebKit 198278](https://bugs.webkit.org/show_bug.cgi?id=198278)). The host is expected on Chrome/Edge on Windows.

### 2.2 Quota

[MDN — Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), last modified **2026-01-05**, accessed 2026-08-07; cross-checked against [web.dev — Storage for the web](https://web.dev/articles/storage-for-the-web).

| Browser | Per-origin quota | On a 1 TiB disk |
|---|---|---|
| **Chrome / Edge** (expected) | **60% of total disk size** | ~600 GiB |
| **Firefox** | best-effort min(10% of disk, **10 GiB** per site group) | 10 GiB |
| **Safari** (macOS 14+/iOS 17+) | ~60% of disk | ~600 GiB |
| **localStorage, all** | 5 MiB | — |

Reduced modes: Chrome Incognito — **sources conflict** (~5% of disk / ~100 MB / ~500 MB); Chrome "clear cookies and site data when you close all windows" — **~300 MB** ([web.dev](https://web.dev/articles/storage-for-the-web)).

> **Conclusion: quota is not a constraint on this product.** A 150-question draft is **~52 MB of media** (§8). Even the smallest reduced-mode figure (~300 MB) is **6× that**. Chrome's normal quota is four orders of magnitude above it. What matters is **eviction** (§3), not the ceiling.

### 2.3 The `estimate()` trap — still worth stating

`estimate()` returns `{usage, quota}` over IndexedDB + Cache API + OPFS. In Chrome the quota derives from **total disk size, not free space**, deliberately, as anti-fingerprinting (MDN 2026-01-05: *"Quota calculation based on total disk size (not available space) to prevent fingerprinting"*).

> On a 1 TB laptop with 2 GB free, `estimate().quota` still reports ~600 GiB. **Never show that number to the host.** Treat it as an upper bound; rely on catching `QuotaExceededError` (§11.2). An older Chrome article ([2017-08-02](https://developer.chrome.com/blog/estimating-available-storage-space/)) says free space *is* a factor; the 2026 sources say it is not.

### 2.4 `persist()` — do not call it

| Browser | Behaviour | Source |
|---|---|---|
| Chrome / Edge | **No prompt, ever.** Silently granted if the site is judged "important"; otherwise **silently denied** | [web.dev — Persistent storage](https://web.dev/articles/persistent-storage); [MDN](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) |
| Firefox | **Prompts** the user | same |
| Safari | Auto-decides silently | same |

> **Ruling: do not call `navigator.storage.persist()`.** In Firefox it throws an unexplained permission popup at a non-technical host for a draft that is temporary by design, and in Chrome the result is a silent coin-flip you cannot influence. **The archive is the published site plus the saved file (§3) — that is the correct place for durability, not a browser flag.** `persisted()` may be read as a diagnostic.

---

## 3. How the host loses work — and the two things that recover it

| # | Scenario | Recovered by |
|---|---|---|
| 1 | Clears browsing data / "cookies and site data" | Published site, or saved file |
| 2 | Authored in a private/incognito window (wiped on close) | Published site, or saved file |
| 3 | **Accidental refresh / tab close mid-authoring** | **The IndexedDB draft — this is the only thing it protects (§11)** |
| 4 | Different browser or profile | Published site, or saved file |
| 5 | Different device | Published site, or saved file |
| 6 | Storage-pressure eviction (LRU, whole origin, MDN 2026-01-05) | Published site, or saved file |
| 7 | **Safari 7-day rule** — script-created storage deleted after 7 days with no interaction, when tracking prevention is on (MDN 2026-01-05) | Published site, or saved file |
| 8 | New PC / profile reset / disk wipe | Published site, or saved file |
| 9 | Browser sync does not carry IndexedDB | Published site, or saved file |

**The durability story in one line:**

> **Publishing is the primary backup — the game lives in a git repository with history. The saved `.zip` is the secondary backup and the way to move authoring to another machine. The IndexedDB draft protects one thing only: an accident during a single sitting.** All three have different jobs; none substitutes for another.

Useful sub-fact: `https://<user>.github.io/repo-a/` and `.../repo-b/` share **one origin**, so renaming the repo or changing the sub-path does **not** lose the draft. Moving to a custom domain does.

---

## 4. Images — automatic downscaling is mandatory

| Stage | Size |
|---|---|
| Typical 12 MP phone photo | **3–6 MB** (estimate) |
| A modern phone panorama, 48 MP shot, or ProRAW | **25–75 MB** (estimate) — **this alone breaches the 25 MiB upload cap (§7.2)** |
| After downscale to 1600 × 900 and `canvas.toBlob('image/jpeg', 0.80)` | **150–300 KB** (estimate) |
| **Reduction** | **~15–30×**, and up to ~250× for a panorama |

**Formats:** **JPEG** for photos, **PNG** for graphics/transparency, **WebP** as the re-encode target (97%+ support: Chrome 32+, Firefox 65+, Safari 14+, Edge 18+ — accessed 2026-08-07). **Accept AVIF uploads** (decodes on Chrome 85+, Firefox 93+, Safari 16.4+) but **never produce it** — `canvas.toBlob()` cannot reliably encode AVIF.

**Target: 1600 px on the long edge.** The shared screen is 1080p at most and the audience reads it from metres away; 1600 px already exceeds perceptual need.

**Three mandatory implementation details:**

1. **Bake in EXIF orientation.** Canvas encode **strips all EXIF**, including the orientation tag. Use `createImageBitmap(blob, { imageOrientation: 'from-image' })` and draw *that* — otherwise portrait phone photos appear sideways on the majlis screen and the game gets blamed.
2. **Never upscale.** If the source is smaller than the target, keep the original bytes — re-encoding a small image usually makes it larger *and* worse.
3. **Do it silently at add time, not at publish time.** The host must never see a "compress" step, and the draft must hold the downscaled bytes so the size counter tells the truth from the first question.

---

## 5. Audio

### 5.1 Format and bitrate — safe across all browsers

| | Recommendation | Basis |
|---|---|---|
| **Container/codec** | **MP3**, or **AAC in `.m4a`** | Both are universally decodable. For decode, AAC is effectively universal ([MDN codec guides](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs), accessed 2026-08-07). **There is no audio equivalent of the HEVC trap** |
| **Bitrate** | **128 kbps** (stereo) — **96 kbps mono is ample** for speech | 128 kbps = 128,000 ÷ 8 × 60 = **0.96 MB per minute** |
| **Accept on upload** | MP3, M4A/AAC, and **WAV with a warning** | — |
| **Opus / OGG** | Accept if it plays; do not produce | Broadly supported but gains nothing here |

**WAV is the one audio file that can break the budget.** 44.1 kHz / 16-bit / stereo = 44,100 × 2 × 2 = **176,400 B/s = ~10.6 MB per minute**. A three-minute WAV is **~32 MB — over the 25 MiB per-file upload cap on its own (§7.2)**, and 33× the size of the same clip as MP3 for no audible gain over a majlis speaker.

> **Ruling: warn loudly on WAV over ~2 MB and tell the host to convert.** Do **not** build in-browser audio transcoding: the platform has no offline audio encoder, `MediaRecorder` is realtime-only and produces WebM/Opus in Chrome. A 2 MB ceiling achieves the same result for ~10 lines.

### 5.2 Per-file ceiling

| Media | Ceiling | Derivation |
|---|---|---|
| **Image** | **400 KB** | 1600×900 JPEG q0.80 lands at 150–300 KB; 400 KB is ~1.5× headroom |
| **Audio** | **2 MB** | 0.96 MB/min at 128 kbps → 2 MB ≈ **2 minutes**, twice any plausible quiz clip |

### 5.3 Autoplay — the one video finding that survives

Verified against [chromium.org — Autoplay](https://www.chromium.org/audio-video/autoplay/) and [developer.chrome.com — Autoplay policy](https://developer.chrome.com/blog/autoplay) (article 2017-09-13; enforced Chrome M66 April 2018, extended to Web Audio M70 October 2018), accessed 2026-08-07:

- Autoplay **with sound** requires that **the user has clicked anywhere on the document in this navigation** (scrolling does not count), or that the MEI threshold is met, or the site is installed as a PWA.
- Activation applies to **contiguous navigations** — **a reload resets it**.
- `play()` returns a Promise that rejects with `NotAllowedError`. It **must** be caught.

**This binds `<audio>` directly, and audio is now a primary media type.** The immune design is unchanged and costs one button:

> **Never rely on autoplay. Every clip starts from the host's own click on a big "شغّل" control.** That click *is* the user activation, so sound plays. After a mid-game refresh, activation is gone until he clicks — and he must click "شغّل" anyway.

*Source-quality note kept on the record:* a claim of a "2026 Chrome strict-mode autoplay policy (Chrome 124, March 2026)" from `alibaba.com/product-insights` is **rejected** — Chrome 124 shipped **April 2024**, and no Chromium/chromestatus source corroborates it. If observed in a real browser, report it **with the Chrome version string**.

---

## 6. Filenames — content-addressed, lowercase ASCII

**All published media filenames must match `^[a-z0-9-]+\.[a-z0-9]+$`.** Recommended scheme: the first 12 hex characters of the media's SHA-256, which the manifest already carries — `m/3f9a1c8b2d40.jpg`. Arabic titles live **inside** `questions.json`, where UTF-8 is unambiguous.

Four independent reasons, any one sufficient:

| # | Reason |
|---|---|
| 1 | **Unicode normalization.** macOS decomposes filenames (NFD), Windows/Linux use NFC. The same visible Arabic name becomes two different byte sequences after a round trip through a Mac, a zip tool or a git client → the URL no longer matches the file → **404 with no visible cause** |
| 2 | **Percent-encoding.** Arabic filenames must be percent-encoded in URLs, and every layer (browser, git, CDN, file manager) must agree. One disagreement is a 404 |
| 3 | **Case sensitivity.** Windows is case-insensitive; the GitHub Pages server is case-sensitive. `Photo.JPG` works locally and 404s published |
| 4 | **Free cache-busting.** A content-addressed name changes only when the bytes change, so a re-publish can never serve a stale file, and unchanged media keeps its name so git stores no new blob |

This also satisfies v3 §1 rule 4 (Latin-only paths).

---

## 7. The publish path

### 7.1 What the export produces

```
questions.json          <- manifest + all Arabic text, UTF-8
m/
  3f9a1c8b2d40.jpg
  a71e0d55c9b3.mp3
  ...
```

That is the whole contract. The engine bundle is built and uploaded separately (`static-delivery-expert`).

**How the browser writes it** — two mechanisms, both worth building:

| # | Mechanism | Browsers | What the host does |
|---|---|---|---|
| 1 | **One `.zip` download he extracts, then drag-drops into GitHub's web uploader** | **All** | Click "صدّر للنشر" → extract (native in Windows/macOS) → drag the files into the GitHub upload page → commit |
| 2 | **`showDirectoryPicker()` writing the files directly into a folder** | **Chrome/Edge 86+ only** ([Chrome docs](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access), accessed 2026-08-07); folder permission can be made persistent since **Chrome 122** ([Persistent permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)) | Pick the folder once; later publishes are one click |

**Never** one download per media file — Chrome throttles and prompts on multiple automatic downloads, and the host ends up with files scattered in Downloads.

### 7.2 The cap that actually binds: the web uploader

For a non-developer publishing through the GitHub web interface (not git), the binding limits are **25 MiB per file** and **100 files per upload batch** (per the coordinator's brief; confirmation belongs to `static-delivery-expert`).

| Limit | Our largest / count | Headroom |
|---|---|---|
| **25 MiB per file** | largest file = **2 MB** audio | **12.5× under.** Images at 400 KB are **64× under** |
| **1 GB published site (soft)** | see §8 | **17–39× under** |
| **100 files per batch** | see §8 — **this is the one that bites** | — |

### 7.3 Export-time validation (all cheap, all prevent a broken site)

1. No single file > 25 MiB — hard block with the reason.
2. Every filename matches `^[a-z0-9-]+\.[a-z0-9]+$`.
3. Every manifest reference resolves to a present file; no orphans.
4. Every file's SHA-256 matches its manifest value — catches a corrupted blob before publishing rather than at question 31.
5. **If the media count exceeds 100, split the export into numbered batches** (`m-batch-1/`, `m-batch-2/`) *or* state plainly in the export screen: *«ارفع ملفات المجلد على دفعتين»*. See §8.3.

---

## 8. The size budget — images and audio only

### 8.1 Assumptions, stated once

Engine bundle ~5 MB. Images at 250 KB average (after §4 downscaling), audio at 45 s × 128 kbps = 0.72 MB average. Text-only questions cost nothing.

### 8.2 Two game sizes

**A 60-question game** — 25 image, 20 audio, 15 text-only:

| Component | Arithmetic | Size | Files |
|---|---|---|---|
| Images | 25 × 250 KB | 6.25 MB | 25 |
| Audio | 20 × 0.72 MB | 14.4 MB | 20 |
| `questions.json` | 60 questions of Arabic text | < 0.1 MB | 1 |
| Engine | | 5 MB | ~10 |
| **Total** | | **≈ 25.8 MB** | **~56** |

**A 150-question game** — 65 image, 50 audio, 35 text-only:

| Component | Arithmetic | Size | Files |
|---|---|---|---|
| Images | 65 × 250 KB | 16.25 MB | 65 |
| Audio | 50 × 0.72 MB | 36.0 MB | 50 |
| `questions.json` | | ~0.2 MB | 1 |
| Engine | | 5 MB | ~10 |
| **Total** | | **≈ 57.5 MB** | **~126** |

### 8.3 Headroom against every real limit

| Limit | 60 questions (25.8 MB, 56 files) | 150 questions (57.5 MB, 126 files) |
|---|---|---|
| **25 MiB per file** | largest is 2 MB → **12.5× under** | same → **12.5× under** |
| **1 GB site (soft)** | **2.6% used → 39× headroom** | **5.8% used → 17× headroom** |
| **~100 GB/month bandwidth** | 100,000 ÷ 25.8 ≈ **3,876 full cold plays/month** | 100,000 ÷ 57.5 ≈ **1,739 full cold plays/month** |
| **100 files per upload batch** | **56 files — one batch, fine** | **126 files — needs two batches** |

> **Confirmed: with images and audio only, size is effectively unconstrained.** A 150-question game uses under 6% of the site limit and would allow more than 1,700 complete first-time plays a month for free. The host could publish **seventeen** games this size before approaching the 1 GB soft limit.
>
> **The one thing that still bites is the 100-files-per-batch cap, and it is a file-count problem, not a size problem.** It arrives at roughly **130+ questions** (assuming ~75% carry media), long before any size limit. It is not a failure — it is one extra drag-and-drop — but the export screen must say so up front, because a non-technical host who uploads 100 of 126 files and stops gets a game with silently missing images.

### 8.4 The two things that could still break the budget

Both are prevented by the authoring pipeline, and both are *only* prevented there:

| # | Breaker | What it does | Prevention |
|---|---|---|---|
| 1 | **Skipping automatic image downscaling** | 65 un-processed phone photos at 4 MB = **260 MB** instead of 16 MB (10× the whole budget). Worse, **a single panorama or 48 MP shot at 25–75 MB breaches the 25 MiB per-file cap by itself** and cannot be uploaded at all | §4 — downscale silently at add time, never optional |
| 2 | **Accepting WAV** | A 3-minute WAV is **~32 MB — over the 25 MiB cap on its own**, and 33× the MP3 size | §5.1 — warn above ~2 MB and refuse to publish it |

**Nothing else in the product can breach any limit.** That is the whole risk surface now.

---

## 9. The two open handoffs to `static-delivery-expert` — resolved

| Question (raised in v3 §14.4) | Status now |
|---|---|
| **Does GitHub Pages answer HTTP Range requests with `206`?** | **No longer blocking. Downgrade to low priority.** It mattered because **Safari refuses to play `<video>` at all** without a 206 response. With no video, the remaining exposure is audio seeking. Our audio files are **~0.7–2 MB**, which a browser fetches in a single GET; there is no scrubbing requirement in a quiz. I have **not** verified whether Safari applies the same 206 strictness to `<audio>` as to `<video>` — so: **do not drop it silently, but do not block on it.** One `curl -sI -H "Range: bytes=0-99" …` if Safari ever enters scope. The host is on Chrome/Edge |
| **What is the actual `Cache-Control` on GitHub Pages assets?** (community-reported `max-age=600`, unconfirmed — [discussion #11884](https://github.com/orgs/community/discussions/11884)) | **Drop as a concern.** It only affected repeat-visit bandwidth, and at 26–58 MB per site with 1,700–3,900 plays of headroom per month it cannot matter. Content-addressed filenames (§6) remain worth doing for **correctness** — never serving a stale file after a re-publish — not for bandwidth |

Still owned by `static-delivery-expert`: confirming the 25 MiB / 100-file web-upload caps, the engine bundle's own size, sub-path `base` configuration, `.nojekyll`, case-sensitivity between Windows and the host, and service-worker caching if offline play is wanted.

---

## 10. Save to computer, and import back

Kept at the user's explicit request; its role is **backup and moving authoring between his own devices**, not delivery.

### 10.1 Format: a single `.zip`, media entries STORED

| Criterion | Verdict |
|---|---|
| **Overhead** | **0%** with ZIP method 0 (STORE). Media is already entropy-coded, so deflate would buy 0–2%. Deflate `manifest.json` only — `CompressionStream('deflate-raw')` is Baseline in all engines since ~May 2023 ([web.dev](https://web.dev/blog/compressionstreams)) |
| **Library** | **None needed.** A STORE-only ZIP is local header + data + central directory + EOCD plus CRC-32, in both directions |
| **Load speed on import** | Read the **last 64 KB** → central directory → manifest. **Time-to-ready is independent of pack size** |
| **Extension** | **`.zip`** — every transport treats it as an ordinary document, Windows and macOS open it natively, and the host can look inside and see his own photos |
| **Entry names** | ASCII (`m/0007.mp3`); Arabic titles inside `manifest.json`. Arabic ZIP entry names need the UTF-8 flag (bit 11) and still produce mojibake in some Windows tools |

**Runner-up, now genuinely close:** a single JSON with base64-embedded media. Without video, a 60-question pack is ~21 MB of media → ~28 MB of base64 (the inflation is exactly 4/3), which `JSON.parse` handles. At 150 questions (~52 MB → ~70 MB) it becomes uncomfortable — `JSON.parse` peaks at roughly 2.5–3× the file (estimate). **ZIP still wins** on zero overhead, instant import, and the host being able to open it — but base64-JSON is now a legitimate v1 fallback if the ZIP writer slips, capped at ~60 questions.

### 10.2 How the browser writes the file

| | **`showSaveFilePicker()` + `FileSystemWritableFileStream`** | **`<a download>` + `URL.createObjectURL`** |
|---|---|---|
| Browsers | **Chrome/Edge 86+** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker), accessed 2026-08-07) | **All** |
| Real Save dialog, host picks location | **Yes** | No — lands in Downloads |
| Re-save over the same file | **Yes**, one click | No — a second `game (1).zip` appears |
| Memory during write | ~one chunk (streamed) | see below |

**Build both**; the Chrome path is strictly better and matches the expected host.

**The technique that keeps memory flat:** `new Blob([...parts])` where the parts are themselves `Blob`s **does not copy the bytes** — Chrome's blob registry holds references and disk-backed blobs stay on disk. Assemble the pack as `new Blob([hdr1, mediaBlob1, hdr2, mediaBlob2, …, centralDirectory, eocd])` with **nothing materialised in the JS heap**. The one part that must read bytes is the **CRC-32 per entry** — stream each blob through `blob.stream()` in 1 MB chunks so peak memory is one chunk, and **cache the CRC in the draft** so later saves are O(changed media) rather than O(pack).

**Realistic size:** at 21–52 MB, both mechanisms are trivially safe. The estimated ~1–2 GB ceiling of the anchor-download path (unmeasured) is now **20–90× above anything this product produces**, so it stops being a design consideration. Do keep a **progress indicator** — CRC plus disk write over 50 MB is a visible pause, and an un-narrated freeze reads as a crash.

### 10.3 Import

The same reader as any pack: `file.slice(-65536)` → EOCD → central directory → assert every media entry has `method === 0` → parse the manifest → write the questions and blobs into the IndexedDB draft. Validate `formatVersion`; a version **higher** than the app understands is a **hard, explained refusal — never a partial load**. A partial import that silently drops question 30's image is worse than a clean refusal.

### 10.4 Carrying the file

| Route | Limit | Re-compresses? | A 21–52 MB pack |
|---|---|---|---|
| **USB stick** | FAT32: 4 GiB per file; exFAT/NTFS unlimited | Never | **Perfect** |
| **WhatsApp — as a *document*** | **2 GB** ([announced 2022](https://www.infobae.com/en/2022/03/23/whatsapp-increases-the-size-of-documents-that-can-be-sent-to-2-gb), accessed 2026-08-07) | **No** | **Works** |
| **WhatsApp — as photo/video** | photos crushed | **Yes** | Never send it this way |
| **Gmail attachment** | **25 MB per message**, and Gmail encodes attachments so the true maximum is **lower** ([Gmail Help](https://support.google.com/mail/answer/6584), accessed 2026-08-07) | Refuses | **60 questions: borderline. 150 questions: refused** |
| Cloud link (free tiers) | — | No | Works — a user decision (`durability-advisor`) |

**Also worth offering, nearly free:** a **"احفظ الأسئلة فقط"** export — manifest and text, no media. That is well under 1 MB and emails easily; it is how the host shares a question set with a relative who will add their own pictures.

---

## 11. The draft, and the reduced quota check

### 11.1 Ruling: a working draft during authoring, never presented as permanent

| | **Draft — IndexedDB** | **Archives — published site + saved `.zip`** |
|---|---|---|
| Protects against | **Accidental refresh, tab close, browser crash** — §3 row 3, and nothing else | **Everything else** — §3 rows 1, 2, 4–9 |
| Created | Automatically, continuously, silently | By explicit action |
| Presented as | *«مسودة على هذا الجهاز»* — explicitly temporary | *«لعبتك المنشورة»* / *«نسختك»* |
| Deleted | An explicit *«امسح المسودة»* button, or by the browser | By the host, like any file |

Three rules that follow:

1. **Do not call `persist()`** (§2.4).
2. **Prompt on return, never auto-resume silently:** *«لديك مسودة من [التاريخ] — تابع، أو ابدأ من جديد، أو احذفها»*. Otherwise the host cannot tell whether he is editing yesterday's work.
3. **On `QuotaExceededError`, do not fail — offer the save:** *«لم يعد هناك مكان للمسودة — احفظ لعبتك في الكمبيوتر الآن»*, with the button in the message.

### 11.2 The quota check, reduced to four steps

> **This supersedes the seven-step, 400 MB write probe of v2/v3 §7.** With a ~52 MB maximum draft and two real archives, that probe is disproportionate.

| # | Step | Purpose |
|---|---|---|
| 1 | `await navigator.storage.estimate()` — record; **never display `quota`** (§2.3) | Diagnostics |
| 2 | Detect a reduced mode: on desktop a reported `quota` under ~1 GiB strongly signals Incognito or "clear on close" (~300 MB) | Warn *«أنت في نافذة خاصة — كل شيء سيُمحى عند الإغلاق»* **before** 60 questions are authored |
| 3 | Wrap every draft write in a `QuotaExceededError` handler that offers the save | The real protection |
| 4 | Live size counter plus a **"آخر حفظ / آخر نشر: …"** timestamp that turns red on unsaved changes | The nag that makes the archives actually happen |

---

## 12. Blob / ObjectURL lifecycle — reduced stakes, same discipline

With video gone, the memory stakes collapse: a leaked object URL now pins **250 KB–2 MB**, not a 30–60 MB decoder. A whole 150-question session leaking everything would pin ~52 MB — unpleasant, not fatal. The discipline is still worth keeping because it costs nothing.

| # | Rule |
|---|---|
| 1 | One object URL per displayed media; revoke when the question leaves the screen |
| 2 | **Never store an object URL persistently.** Store the `Blob`; mint the URL at display time — object URLs die with the document |
| 3 | Before revoking an `<audio>` source: `removeAttribute('src')` → `load()` → **then** revoke |
| 4 | **Reuse ONE `<audio>` element for the whole session.** Swap `src`; never create one per question |
| 5 | `URL.createObjectURL`, **never** `FileReader.readAsDataURL` for display — a data URL is base64 (+33%) in the string heap *and* the DOM |
| 6 | `createObjectURL` is unavailable in **Service Workers** ([MDN, last modified 2025-07-23](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)); available in Window and Web Workers |
| 7 | Handle `error` and read `el.error.code`: `1 ABORTED · 2 NETWORK · 3 DECODE · 4 SRC_NOT_SUPPORTED`. Published over HTTP, **code 2 = the file did not arrive** (404 — almost always a filename case or encoding problem, §6); from an imported pack, **code 3 = damaged bytes** (cross-check `sha256`) |
| 8 | Always `.catch()` `play()`; on `NotAllowedError` show the "شغّل" button (§5.3) |

**Note this is a bare `<audio>` product now:** no posters, no `readyState` gating, no buffering states. An image `<img>` and a ~1 MB `<audio>` over HTTP need none of the machinery that video required.

---

## 13. Remaining unknowns

| # | Unknown | How to close it |
|---|---|---|
| 1 | **Confirmation of the 25 MiB / 100-files web-upload caps** — I am using the coordinator's figures | `static-delivery-expert`, against current GitHub docs. **It drives §8.3, so it is the highest-value one** |
| 2 | Whether Safari applies the same `206`/Range strictness to `<audio>` as to `<video>` | One `curl` if Safari enters scope (§9). Not blocking |
| 3 | Chrome's real Incognito quota — sources conflict (~5% of disk / ~100 MB / ~500 MB) | One `estimate()` call in an Incognito window. Now nearly moot: even the lowest figure is 6× the largest draft |
| 4 | Whether modern Safari still has IndexedDB-Blob problems (evidence is ~2015–2016) | A write/read round-trip on a current Safari. Low priority |
| 5 | Whether the "Chrome 2026 strict autoplay" claim reflects anything real (§5.3) | Report with the Chrome version string if observed |
| 6 | The host's actual **free disk space** | **Unclosable by API** (§2.3). Catch the failure rather than predict it |

**Closed by this revision:** everything in Appendix C, plus the Range-request blocker and the `Cache-Control` question (§9).

---

## 14. Handoffs

| Question | Owner |
|---|---|
| Confirming the web-upload caps; engine bundle size; sub-path `base`; `.nojekyll`; Windows↔host case sensitivity; service-worker caching if offline play is wanted | **`static-delivery-expert`** |
| Whether both save mechanisms (§10.2) ship in v1; whether import ships in v1; how many questions v1 targets | **`scope-advisor`** |
| How hard to push publishing and saving; whether the extra exports (§10.4) are worth it | **`durability-advisor`** |
| Exact Arabic wording of every message named here; how an image and an audio player look and read from metres away | **`rtl-stage-ux-expert`** |
| Where the media step sits in the question flow; surviving a mid-game refresh | **`game-systems-expert`** |

---

## Appendix A — superseded sections (v3 §9.5: struck and referenced, not erased)

| Struck | What it said | Why void | Replaced by |
|---|---|---|---|
| ~~v4 §0 — "engine only; pack uploaded at play time; nothing stored"~~ | The link carries the engine; the player picks a pack from disk each night; nothing persists | **Reverted by the user 2026-08-07**: «أبي أرفع اللعبة وأجهزها قبل المسابقة وخلاص» | **§0** (author → publish → play) |
| ~~v4 §6 — the load step (drop target, 2 actions to playing)~~ | Full-screen drop target; one file vs file+folder; time-to-playable independent of pack size | No pack is loaded at play time | **§10.3** — the reader survives verbatim, now used for **import** |
| ~~v4 §8 — playback from a local pack~~ | Lazy `file.slice()` playback, the safe pattern, memory arithmetic | Media is served over HTTP again | **§12** |
| ~~v3 §12 — build-time bridge to a publishable folder~~ | Export `questions.json` + `m/<hash>.<ext>`; ZIP-then-extract or `showDirectoryPicker()` | — **reinstated** | **§7** (valid again) |
| ~~v3 §13 — publish budget~~ | Per-file publish ceilings and whole-site profiles including video | Video cancelled; recomputed | **§8** |
| ~~v3 §14 — media over the network~~ | Preload strategy, download-time tables, Range/`Cache-Control` verification | Video cancelled; both questions resolved | **§9, §12** |
| ~~v3 §1.4 — call `persist()`~~ | Request persistent storage to resist eviction | Prompts Firefox users for a temporary draft; silent coin-flip in Chrome | **§2.4** |
| ~~v2/v3 §7 — seven-step 400 MB write probe~~ | Probe real quota with incompressible random blobs | Disproportionate: ~52 MB draft, two real archives | **§11.2** |

## Appendix B — derivations for every estimate

| Figure | Derivation |
|---|---|
| base64 = +33.33% | 4 output chars per 3 input bytes, exactly |
| `JSON.parse` peak ≈ 2.5–3× file | source string + parsed object graph + decoded binary copies coexisting. **Estimate** |
| MP3 128 kbps = 0.96 MB/min | 128,000 ÷ 8 × 60 |
| WAV = ~10.6 MB/min | 44,100 Hz × 2 ch × 2 B = 176,400 B/s × 60 |
| Phone photo 3–6 MB → 150–300 KB | typical 12 MP JPEG; 1600×900 at q0.80. **Estimate** |
| Panorama / 48 MP / ProRAW 25–75 MB | **Estimate** — order of magnitude |
| 60-question site 25.8 MB | 25×250 KB + 20×0.72 MB + 5 MB engine |
| 150-question site 57.5 MB | 65×250 KB + 50×0.72 MB + 5 MB engine |
| 3,876 / 1,739 plays per month | 100,000 MB ÷ site size |
| 100-file cap reached at ~130 questions | 100 media files ÷ 0.75 media-bearing questions |
| Anchor-download ceiling ~1–2 GB | **Estimate**, blob-backed download, unmeasured. Now irrelevant (§10.2) |

## Appendix C — video findings, cancelled but preserved

Kept in full detail so that reversing the video decision costs a read, not a re-investigation. **None of this applies to the current product.**

| # | Finding | Detail |
|---|---|---|
| **C.1** | ~~**The HEVC trap**~~ | iPhones record HEVC by default. Chrome shipped HEVC decode in **v107**, but on Windows plays it **only** with a hardware HEVC decoder **and** OS-level HEVC Video Extensions ([bitmovin](https://bitmovin.com/blog/google-adds-hevc-support-chrome/); [StaZhu](https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding), accessed 2026-08-07) — a **paid** Microsoft Store item on many machines. Safe baseline was MP4/H.264/AAC (~98%+, [MDN video codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)). VP9/WebM: not Safari. AV1: Safari only on Apple Silicon M3+. Mitigation was `canPlayType` **plus** a real load-to-`loadedmetadata` test at add time |
| **C.2** | ~~**Range / `206` dependency**~~ | **Safari refuses to play `<video>` at all** if the server does not answer Range requests with `206`; Chrome degrades to a full download and loses seeking. Unverified on GitHub Pages; one `curl -sI -H "Range: bytes=0-99"` would settle it |
| **C.3** | ~~**The 100 MB per-file wall**~~ | A single untouched one-minute iPhone 4K clip is **170–375 MB** — over the wall on its own |
| **C.4** | ~~**Video memory blow-up**~~ | 720p frame = 1280×720×1.5 B = **1.38 MB**; DPB of 4–16 frames = 5.5–22 MB; plus demuxer read-ahead ~10–30 MB → **~30–60 MB per video element in flight**. A new `<video>` per question left referenced across 40 questions = **1.2–2.4 GB → tab death mid-majlis**. Mitigations were: reuse one element, bounded object-URL window, auto-generated `poster`, `readyState >= 3` gated reveal with a 5–8 s timeout |
| **C.5** | ~~**Bitrate budget**~~ | `MB/min = Mbps × 7.5` exactly. 720p @1.5 Mbps = 11.25 MB/min → a 30 s clip = **5.6 MB**. Phone sources: iPhone 1080p/30 H.264 ~125–150 MB/min, HEVC ~60; 4K/30 H.264 ~350–375, HEVC ~170 ([macxdvd](https://www.macxdvd.com/mac-video-converter-pro/4k-video-file-size.htm), [videoproc](https://www.videoproc.com/iphone-video-processing/iphone-video-size-per-minute.htm)). Recommended ceilings were 8 MB warn / 15 MB hard per clip |
| **C.6** | ~~**In-browser transcoding**~~ | WebCodecs + an MP4 demuxer *and* muxer would buy ~15× but neither is in the platform, encoder behaviour varies by GPU/driver, and Firefox/Safari support was unverified. `MediaRecorder` is realtime-only and outputs WebM in Chrome. Verdict was: warn and instruct, never transcode, in v1 |

---

## For the user-facing deck

Two choices. The planner translates into Arabic; the numbers must survive intact.

---

### Choice 1 — How big may your game get?

Your game is questions with **text, pictures and sound**. The game shrinks every picture automatically the moment you add it — a 5 MB photo from your phone becomes about **200 KB** with no visible difference on a TV. You do nothing.

| | **A. About 60 questions** | **B. About 150 questions** |
|---|---|---|
| **Roughly** | 25 with a picture, 20 with a sound clip, 15 plain text | 65 with a picture, 50 with a sound clip, 35 plain text |
| **Whole size of your published game** | **26 MB** | **58 MB** |
| **Of your 1,000 MB allowance** | **2.6%** — you could publish **thirty-nine** games this size | **5.8%** — you could publish **seventeen** |
| **People who can play it for free each month** | **about 3,876** complete plays | **about 1,739** complete plays |
| **Uploading it to the internet** | **56 files — one drag and drop** | **126 files — two drags instead of one**, because the upload page takes 100 at a time. The game will tell you this before you start |

> **The honest answer: size is not a problem for you.** Even the larger game uses under 6% of your allowance, and the biggest single file in it is a **2 MB** sound clip against a 25 MB per-file limit — **twelve times under**.
>
> **The only thing that changes with size is the number of files you drag when publishing**, and that only matters past about 130 questions.
>
> **Two things could still break it, and the game prevents both for you:** a very large photo (a panorama or a 48-megapixel shot can be 25–75 MB on its own — the game shrinks it before it ever counts), and an uncompressed WAV sound file (a 3-minute one is 32 MB — the game will ask you to convert it).

---

### Choice 2 — What protects your work before you publish it?

Until you publish, your game lives **only inside your browser on this one laptop**. Clearing your browsing data deletes it, a private window deletes it on close, and it does not exist on any other browser or computer.

Once you publish, **the published game itself is your backup** — you can always reload it from there. And you can also save a **single file** to your computer at any time, which is how you move your work to another machine or keep a copy.

| | **A. Gentle** | **B. Insistent** *(recommended)* |
|---|---|---|
| **While you write** | A quiet size counter, and buttons to publish or save when you want them | The same, plus a visible warning the moment you have work that is not published or saved, and a reminder every time you close the editor |
| **If you press refresh by accident** | The game asks: *"you have a draft from yesterday — continue, start fresh, or delete it"* | Same |
| **If your browsing data is cleared before you publish** | Everything since your last publish or save is gone, with no warning | You almost certainly published or saved in that same sitting |
| **The draft on your computer** | Held only while you are writing, on **this browser and this computer only** — never online, never on a server. There is a **«امسح المسودة»** button, and clearing your browser removes it too | Same |
| **The file you can save** | About **26 MB** for a 60-question game, **58 MB** for 150. Fits any USB stick; sends on WhatsApp **as a document** (up to 2 GB). **Too big to email** — Gmail refuses over 25 MB. There is also a **"questions only, no pictures or sound"** save, under 1 MB, which does email | Same |

> **If you pick A**, then one "clean up the computer" click can erase everything you wrote since your last publish.
> **If you pick B**, then the game will occasionally nag you to publish or save — and that nagging is what makes sure there is always a copy.

---

*End of report, v5. Written 2026-08-07 by `media-storage-expert`. Every external fact carries its source and access date; every number without a source is an estimate whose derivation is in Appendix B. Superseded material is preserved in Appendix A, cancelled video findings in Appendix C, per v3 §9.5.*
