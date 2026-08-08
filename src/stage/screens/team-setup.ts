import { deckBand, preselectTrackLength, type TrackPreset } from '../../core/rules/deck-bands';
import { formatDigits } from '../format-digits';

export interface TeamSetupParams {
  deckSize: number;
  onConfirm: (params: { teamNames: [string, string]; N: TrackPreset }) => void;
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
 */
export function renderTeamSetupScreen(container: HTMLElement, p: TeamSetupParams): void {
  container.innerHTML = '';

  const safe = document.createElement('div');
  safe.className = 'stage-safe';

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

  function updateBandLine(): void {
    const band = deckBand(p.deckSize, selectedN);
    if (band === 'green') {
      bandLine.textContent = '';
    } else if (band === 'warn') {
      bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — تكفي غالباً، وإذا كثرت الأخطاء ممكن تخلص الأسئلة قبل ما يوصل أحد`;
    } else {
      bandLine.textContent = `أسئلتك ${formatDigits(p.deckSize)} — تكفي لمسار ${formatDigits(selectedN)} خطوات`;
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

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'op-button primary type-operator-button';
  confirmBtn.textContent = 'ابدأ';
  confirmBtn.addEventListener('click', () => {
    const a = nameA.value.trim() || 'الفريق الأزرق';
    const b = nameB.value.trim() || 'الفريق البرتقالي';
    p.onConfirm({ teamNames: [a, b], N: selectedN });
  });

  screen.append(title, nameA, nameB, presetsRow, bandLine, deciderLine, confirmBtn);
  safe.append(screen);
  container.append(safe);
}
