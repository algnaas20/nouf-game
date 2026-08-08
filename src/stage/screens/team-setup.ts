import { deckBand, maxGreenTrackLength, preselectTrackLength, type TrackPreset } from '../../core/rules/deck-bands';
import { formatDigits } from '../format-digits';

export interface TeamSetupParams {
  deckSize: number;
  onConfirm: (params: { teamNames: [string, string]; N: TrackPreset }) => void;
  /** «→ الرئيسية» — same literal wording as the editor shell's own back
   *  button (`src/stage/app.ts`'s `renderEditorShell`). Needed here because
   *  this screen can now genuinely dead-end (every preset refused —
   *  §readiness gate below, worklog-B5.md) — a blocked host must have an
   *  explicit way back to «أسئلتي» to add more questions, not just a
   *  disabled button and nowhere to go. */
  onBack: () => void;
}

const PRESETS: { n: TrackPreset; label: string }[] = [
  { n: 6, label: 'قصيرة' },
  { n: 10, label: 'عادية' },
  { n: 14, label: 'طويلة' },
];

/**
 * The minimum screen needed to reach a real `GAME_STARTED` event — not a
 * polished editor-integration setup flow (no deck picker, no per-question
 * review; that is WL-C/pack territory once wired in). Team-name inputs
 * (`dir="auto"` — S3) plus the deck-band-aware track-length presets
 * (D-09.12/13, from the REAL `src/core/rules/deck-bands.ts`, never a
 * re-derived threshold) and the readiness gate below.
 *
 * **Tier 2, not Tier 1 (2026-08-08, worklog-B6.md, `rtl-stage-ux-expert`'s
 * `addendum-small-screens-2026-08-08.md`):** this screen used to be built
 * on the fixed 1920x1080 `--stage-unit` canvas (`.stage-safe`), which
 * `overflow: hidden`s anything past 1080 stage-px with no scroll — the
 * exact live-user defect ("ما فيه زر ولا شي", 2026-08-08). The expert's
 * ruling: *"a surface may be fixed-canvas only if its content is bounded by
 * construction. Any surface whose height depends on user data, form
 * fields, lists, or prose must be an ordinary scrolling document."* Two
 * typed team names and a variable-length readiness message are exactly
 * that, so this screen is now a normal scrolling document on the
 * close-viewing CSS-px scale (`src/styles/console.css`), mounted by
 * `app.ts` OUTSIDE `.stage-root` (same sibling pattern the editor shell
 * already uses) — never `--stage-unit`, never `position: fixed`. The
 * primary «ابدأ» action is additionally a sticky footer bar
 * (`.console-action-bar`), so it is reachable at every viewport
 * UNCONDITIONALLY, independent of how tall the content above it is — the
 * addendum's own fix #1, "the change to ship first".
 *
 * **Readiness gate (adversarial review F-2/F-3, 2026-08-08, worklog-B5.md):**
 * this screen is the one and only place `GAME_STARTED` gets constructed
 * (`onConfirm` -> `app.ts#startNewGame`), so it is also the one and only
 * place that must refuse to start a game the deck cannot support — refusing
 * here, in plain Arabic, before the majlis, is strictly cheaper than
 * discovering it at question 20 in front of ten people, or — in the empty-
 * or tiny-deck case — freezing on the very first turn-handoff with no undo
 * and no way out at all.
 *
 * **Not yet folded in (disclosed, worklog-B6.md):** `play-experience-advisor`'s
 * `addendum-deck-floor-2026-08-08.md` (a fourth «سريعة» preset, per-chip
 * price sublines, two-number refuse/warn copy) depends on a `PRESETS`
 * change and an `N -> N+1` threshold shift in `src/core/rules/deck-bands.ts`
 * — core-domain, owned by WL-A, not landed in this tree as of this session.
 * Wiring it in once it lands is a small, contained change (this file's
 * `PRESETS` array plus the two band-line branches below), deliberately not
 * re-derived here ahead of time to avoid shipping a number the shipped
 * threshold math cannot actually back up. The one INDEPENDENT correction
 * from that same addendum — «محطات» never «خطوات» for track length — is
 * applied below; it needs no core change.
 */
export function renderTeamSetupScreen(container: HTMLElement, p: TeamSetupParams): void {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'console-root';

  const backBar = document.createElement('div');
  backBar.className = 'console-back-bar';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'console-back-button';
  backBtn.textContent = '→ الرئيسية';
  backBtn.addEventListener('click', p.onBack);
  backBar.append(backBtn);

  const body = document.createElement('div');
  body.className = 'console-body';
  const column = document.createElement('div');
  column.className = 'console-column';

  const title = document.createElement('h1');
  title.className = 'console-title';
  title.textContent = 'أسماء الفريقين';

  const nameA = document.createElement('input');
  nameA.type = 'text';
  nameA.dir = 'auto';
  // `console-input` only — NOT the legacy `team-name-input` class: that
  // class still carries `stage.css`'s own `--stage-unit`-scaled
  // `inline-size: calc(600 * var(--stage-unit))` (resolves to a hard
  // 600px at unit=1), which silently overrode this Tier-2 grid's own
  // sizing (found live via computed-style check, worklog-B6.md — the
  // exact `--stage-unit` leakage this Tier split is supposed to prevent,
  // reintroduced by a stale shared class name rather than a stylesheet).
  nameA.className = 'console-input';
  nameA.value = 'الفريق الأزرق';
  nameA.maxLength = 18;
  nameA.setAttribute('aria-label', 'اسم الفريق الأول');

  const nameB = document.createElement('input');
  nameB.type = 'text';
  nameB.dir = 'auto';
  nameB.className = 'console-input';
  nameB.value = 'الفريق البرتقالي';
  nameB.maxLength = 18;
  nameB.setAttribute('aria-label', 'اسم الفريق الثاني');

  const fieldA = document.createElement('div');
  fieldA.className = 'console-field';
  const labelA = document.createElement('span');
  labelA.className = 'console-field-label';
  labelA.textContent = 'الفريق الأول';
  fieldA.append(labelA, nameA);

  const fieldB = document.createElement('div');
  fieldB.className = 'console-field';
  const labelB = document.createElement('span');
  labelB.className = 'console-field-label';
  labelB.textContent = 'الفريق الثاني';
  fieldB.append(labelB, nameB);

  const fieldGrid = document.createElement('div');
  fieldGrid.className = 'console-field-grid console-section';
  fieldGrid.append(fieldA, fieldB);

  let selectedN: TrackPreset = preselectTrackLength(p.deckSize);

  const trackRow = document.createElement('div');
  trackRow.className = 'console-track-row console-section';
  const trackLabel = document.createElement('span');
  trackLabel.className = 'console-inline-label';
  trackLabel.textContent = 'طول المسار';
  const chipRow = document.createElement('div');
  chipRow.className = 'console-chip-row';
  trackRow.append(trackLabel, chipRow);

  const chips: HTMLButtonElement[] = [];
  const bandLine = document.createElement('p');
  bandLine.className = 'console-readiness-line deck-band-line';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'console-primary-button';
  confirmBtn.textContent = 'ابدأ';
  confirmBtn.addEventListener('click', () => {
    if (confirmBtn.disabled) return; // defensive — the disabled attribute already blocks the click
    const a = nameA.value.trim() || 'الفريق الأزرق';
    const b = nameB.value.trim() || 'الفريق البرتقالي';
    p.onConfirm({ teamNames: [a, b], N: selectedN });
  });

  const smallestPreset = PRESETS[0]!.n;

  /**
   * F-3 fix (adversarial review, 2026-08-08): the refuse-band branch used to
   * substitute `selectedN` — the exact track length that was JUST refused —
   * so the sentence read as if the refused length were sufficient. It now
   * substitutes `maxGreenTrackLength(deckSize)` (already exported by
   * `deck-bands.ts`, never re-derived here): the largest track this exact
   * deck can carry with the green-band's own safety margin, i.e. a number
   * that is actually true. When that number is smaller than the shortest
   * offered preset (6), no preset can be offered honestly — the deck is
   * refused for every track — so the "ابدأ" control is disabled entirely
   * and the message says so instead of naming a track that still cannot be
   * chosen from the row above it.
   *
   * Vocabulary (deck-floor addendum, D-09.26, independent of the blocked
   * preset/threshold change — see file header): track length is «محطات»,
   * never «خطوات».
   */
  function updateBandLine(): void {
    const band = deckBand(p.deckSize, selectedN);
    if (band === 'green') {
      bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — تكفي بارتياح لمسار ${formatDigits(selectedN)} محطات.`;
      confirmBtn.disabled = false;
    } else if (band === 'warn') {
      bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — تكفي غالباً، وإذا كثرت الأخطاء ممكن تخلص الأسئلة قبل ما يوصل أحد`;
      confirmBtn.disabled = false;
    } else {
      const bestN = maxGreenTrackLength(p.deckSize);
      if (bestN >= smallestPreset) {
        bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — تكفي لمسار ${formatDigits(bestN)} محطات`;
      } else if (p.deckSize === 0) {
        // Composed — no Appendix أ literal covers the zero-question case
        // (D-25: this is now the default first experience, not an edge
        // case). Disclosed in worklog-B5.md, not presented as scripted.
        bandLine.textContent = 'لا توجد أسئلة بعد — أضف أسئلتك أولاً من «أسئلتي».';
      } else {
        bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — لا تكفي بعد لأي مسار. أضف المزيد من «أسئلتي».`;
      }
      confirmBtn.disabled = true;
    }
  }

  function selectPreset(n: TrackPreset, btn: HTMLButtonElement): void {
    selectedN = n;
    for (const c of chips) c.classList.remove('is-selected');
    btn.classList.add('is-selected');
    updateBandLine();
  }

  for (const preset of PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'console-chip track-preset-button';
    const bandForChip = deckBand(p.deckSize, preset.n);
    const sub = document.createElement('span');
    sub.className = 'console-chip-sub';
    sub.textContent = bandForChip === 'green' ? 'تكفي بارتياح' : bandForChip === 'warn' ? 'تكفي غالباً' : 'غير كافية';
    const main = document.createElement('span');
    main.textContent = `${preset.label} — ${formatDigits(preset.n)}`;
    btn.append(main, sub);
    if (preset.n === selectedN) btn.classList.add('is-selected');
    btn.addEventListener('click', () => selectPreset(preset.n, btn));
    chipRow.append(btn);
    chips.push(btn);
  }
  updateBandLine();

  column.append(title, fieldGrid, trackRow, bandLine);
  body.append(column);

  const actionBar = document.createElement('div');
  actionBar.className = 'console-action-bar';
  const actionColumn = document.createElement('div');
  actionColumn.className = 'console-column';
  actionColumn.append(confirmBtn);
  actionBar.append(actionColumn);

  root.append(backBar, body, actionBar);
  container.append(root);
}
