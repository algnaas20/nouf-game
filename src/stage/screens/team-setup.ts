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
 * re-derived threshold) and the decider announcement (D-09.8, literal).
 *
 * **Readiness gate (adversarial review F-2/F-3, 2026-08-08, worklog-B5.md):**
 * this screen is the one and only place `GAME_STARTED` gets constructed
 * (`onConfirm` -> `app.ts#startNewGame`), so it is also the one and only
 * place that must refuse to start a game the deck cannot support — refusing
 * here, in plain Arabic, before the majlis, is strictly cheaper than
 * discovering it at question 20 in front of ten people, or — in the empty-
 * or tiny-deck case — freezing on the very first turn-handoff with no undo
 * and no way out at all.
 */
export function renderTeamSetupScreen(container: HTMLElement, p: TeamSetupParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

  const backBar = document.createElement('div');
  backBar.className = 'editor-back-bar team-setup-back-bar';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'op-button type-operator-button editor-back-button';
  backBtn.textContent = '→ الرئيسية';
  backBtn.addEventListener('click', p.onBack);
  backBar.append(backBtn);

  const screen = document.createElement('div');
  screen.className = 'centered-screen team-setup-screen';

  const title = document.createElement('h1');
  title.className = 'type-turn-banner';
  title.textContent = 'أسماء الفريقين';

  const nameA = document.createElement('input');
  nameA.type = 'text';
  nameA.dir = 'auto';
  nameA.className = 'team-name-input type-option';
  nameA.value = 'الفريق الأزرق';
  nameA.maxLength = 18;

  const nameB = document.createElement('input');
  nameB.type = 'text';
  nameB.dir = 'auto';
  nameB.className = 'team-name-input type-option';
  nameB.value = 'الفريق البرتقالي';
  nameB.maxLength = 18;

  let selectedN: TrackPreset = preselectTrackLength(p.deckSize);

  const presetsRow = document.createElement('div');
  presetsRow.className = 'track-presets-row';
  const presetButtons: HTMLButtonElement[] = [];
  const bandLine = document.createElement('p');
  bandLine.className = 'type-option deck-band-line';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'op-button primary type-operator-button';
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
   */
  function updateBandLine(): void {
    const band = deckBand(p.deckSize, selectedN);
    if (band === 'green') {
      bandLine.textContent = '';
      confirmBtn.disabled = false;
    } else if (band === 'warn') {
      bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — تكفي غالباً، وإذا كثرت الأخطاء ممكن تخلص الأسئلة قبل ما يوصل أحد`;
      confirmBtn.disabled = false;
    } else {
      const bestN = maxGreenTrackLength(p.deckSize);
      if (bestN >= smallestPreset) {
        bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — تكفي لمسار ${formatDigits(bestN)} خطوات`;
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
    for (const b of presetButtons) b.classList.remove('is-selected');
    btn.classList.add('is-selected');
    updateBandLine();
  }

  for (const preset of PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'op-button type-operator-button track-preset-button';
    btn.textContent = `${preset.label} — ${formatDigits(preset.n)}`;
    if (preset.n === selectedN) btn.classList.add('is-selected');
    btn.addEventListener('click', () => selectPreset(preset.n, btn));
    presetsRow.append(btn);
    presetButtons.push(btn);
  }
  updateBandLine();

  const deciderLine = document.createElement('p');
  deciderLine.className = 'type-option decider-announce-line';
  deciderLine.textContent = 'إذا وصلوا النهاية سوا → سؤال الحسم';

  screen.append(title, nameA, nameB, presetsRow, bandLine, deciderLine, confirmBtn);
  safe.append(backBar, screen);
  container.append(safe);
}
