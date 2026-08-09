import {
  deckBand,
  maxGreenTrackLength,
  preselectTrackLength,
  questionsNeededForPlayable,
  questionsNeededForComfortable,
  PRESETS,
  type TrackPreset,
} from '../../core/rules/deck-bands';
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

/** D-09.12′ (play-experience-advisor, addendum-deck-floor-2026-08-08.md):
 *  presets are `PRESETS` (imported from core, `[4, 6, 10, 14]`) — «سريعة»
 *  is always visible, never re-derived here. Labels are this screen's own
 *  (copy, not threshold math). */
const PRESET_LABELS: Record<TrackPreset, string> = {
  4: 'سريعة',
  6: 'قصيرة',
  10: 'عادية',
  14: 'طويلة',
};

/**
 * D-09.25, literal, no improvisation: Arabic count agreement for "N more
 * questions". Arabic-Indic digits via `formatDigits`.
 */
function phrase(n: number): string {
  if (n === 1) return 'سؤال واحد';
  if (n === 2) return 'سؤالان';
  if (n >= 3 && n <= 10) return `${formatDigits(n)} أسئلة`;
  return `${formatDigits(n)} سؤالاً`;
}

/**
 * The minimum screen needed to reach a real `GAME_STARTED` event — not a
 * polished editor-integration setup flow (no deck picker, no per-question
 * review; that is WL-C/pack territory once wired in). Team-name inputs
 * (`dir="auto"` — S3) plus the deck-band-aware track-length presets
 * (D-09.12/13, from the REAL `src/core/rules/deck-bands.ts`, never a
 * re-derived threshold) and the readiness gate below.
 *
 * **Tier 2, not Tier 1** (worklog-B6.md, `rtl-stage-ux-expert`'s
 * `addendum-small-screens-2026-08-08.md`) — a normal scrolling document on
 * the close-viewing CSS-px scale (`src/styles/console.css`), with a sticky
 * footer «ابدأ» action bar reachable unconditionally. Unchanged this
 * session.
 *
 * **Deck-floor addendum, folded in this session** (D-09.12′…D-09.28,
 * `addendum-deck-floor-2026-08-08.md`, WL-A's A5 landed the core half —
 * `PRESETS=[4,6,10,14]`, `N->N+1` thresholds, `questionsNeededForPlayable`/
 * `questionsNeededForComfortable`): the fourth «سريعة» preset (N=4), the
 * two-number refuse/warn copy, and the per-chip «ناقصك ⟨…⟩» price sublines
 * — all reading the SAME threshold functions `deckBand` itself compares
 * against, never a re-derived number (D-09.24: "a message whose Nth
 * question does not flip the band is worse than none").
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
  // `console-input` only — NOT the legacy `team-name-input` class (see
  // worklog-B6.md §5 for why: a stale `--stage-unit`-scaled class leaked a
  // hard 600px width into this Tier-2 grid).
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
  const chipSubs: HTMLElement[] = [];
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

  const smallestPreset = PRESETS[0];

  function chipSubline(band: ReturnType<typeof deckBand>, preset: TrackPreset): string {
    if (band === 'green') return 'تكفي بارتياح';
    if (band === 'warn') return 'تكفي غالباً';
    // refuse — D-09.23: the chip is a price, not a dead grey button.
    return `ناقصك ${phrase(questionsNeededForPlayable(p.deckSize, preset))}`;
  }

  /**
   * D-09.21…D-09.24 — every refusal carries the two numbers (how many more
   * to be PLAYABLE, how many more to be COMFORTABLE), because the user's
   * real question was «كيف كافية؟», not «هل يكفي؟» (field evidence,
   * addendum §0). Both numbers come from `questionsNeededForPlayable`/
   * `questionsNeededForComfortable` — the SAME `ceil(threshold) - D` the
   * band check itself uses, so the promised count always actually flips
   * the band (D-09.24).
   */
  function updateBandLine(): void {
    const band = deckBand(p.deckSize, selectedN);
    if (band === 'green') {
      // §4 of the addendum, literal.
      bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — تكفي بارتياح لمسار ${formatDigits(selectedN)} محطات.`;
      confirmBtn.disabled = false;
    } else if (band === 'warn') {
      // §3 of the addendum, literal — the middle sentence states the
      // CONSEQUENCE of running out (an ending, not a crash), then the
      // comfort price.
      const comfortMore = questionsNeededForComfortable(p.deckSize, selectedN);
      bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — تكفي لمسار ${formatDigits(selectedN)} محطات. لو خلصت الأسئلة قبل ما يوصل أحد، يفوز المتقدّم. زد ${phrase(comfortMore)} وتلعب بارتياح.`;
      confirmBtn.disabled = false;
    } else if (p.deckSize === 0) {
      // §2 of the addendum, unchanged/literal — the zero-question case is
      // now the default first experience (D-25), not an edge case.
      bandLine.textContent = 'لا توجد أسئلة بعد — أضف أسئلتك أولاً من «أسئلتي».';
      confirmBtn.disabled = true;
    } else if (deckBand(p.deckSize, smallestPreset) === 'refuse') {
      // §1 of the addendum, literal — below the floor of EVERY preset,
      // including «سريعة». Both numbers computed against N=4, the
      // smallest/fastest preset the copy names.
      const r = questionsNeededForPlayable(p.deckSize, smallestPreset);
      const g = questionsNeededForComfortable(p.deckSize, smallestPreset);
      bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — ناقصك ${phrase(r)} عشان تبدأ لعبة «سريعة» (٤ محطات)، و${phrase(g)} عشان تلعب بارتياح.`;
      confirmBtn.disabled = true;
    } else {
      // The deck supports a SHORTER preset than the one currently selected
      // (F-3 fix lineage, worklog-B5.md) — name the largest one it truly
      // supports rather than the refused selection itself.
      const bestN = maxGreenTrackLength(p.deckSize);
      bandLine.textContent =
        bestN >= smallestPreset
          ? `أسئلتك ${formatDigits(p.deckSize)} — تكفي لمسار ${formatDigits(bestN)} محطات.`
          : `أسئلتك ${formatDigits(p.deckSize)} — لا تكفي بعد لأي مسار. أضف المزيد من «أسئلتي».`;
      confirmBtn.disabled = true;
    }
  }

  function refreshChipSublines(): void {
    for (let i = 0; i < PRESETS.length; i++) {
      const preset = PRESETS[i]!;
      const sub = chipSubs[i];
      if (sub) sub.textContent = chipSubline(deckBand(p.deckSize, preset), preset);
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
    const bandForChip = deckBand(p.deckSize, preset);
    const sub = document.createElement('span');
    sub.className = 'console-chip-sub';
    sub.textContent = chipSubline(bandForChip, preset);
    const main = document.createElement('span');
    main.textContent = `${PRESET_LABELS[preset]} — ${formatDigits(preset)}`;
    btn.append(main, sub);
    if (preset === selectedN) btn.classList.add('is-selected');
    btn.addEventListener('click', () => selectPreset(preset, btn));
    chipRow.append(btn);
    chips.push(btn);
    chipSubs.push(sub);
  }
  updateBandLine();
  refreshChipSublines();

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
