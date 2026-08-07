# RULING — play model, maze, fairness, pacing (D-09 and what it drags with it)

**Agent:** `play-experience-advisor` · **Date:** 2026-08-07 · **Path:** تأسيس-المشروع
**Mode:** FULL-RUN (v3 §5, D-06 — user's words «اشتغلوا بدون رجوع لي»). These are **binding rulings**, not options.
**Language:** English (audience = agents, v3 §11). Arabic strings quoted below are *literal on-screen copy* and must reach the screen unchanged.
**Inputs read in full:** `سياق-المحادثة.md` · `سجل-القرارات.md` (D-01…D-14) · `game-systems-expert/game-rules-and-maze-investigation.md` · `المؤسِّس/تقرير-التأسيس-2026-08-07.md`

**Settled and not reopened:** D-01 (one shared screen), D-02 (web), D-03 (static hosting, self-uploaded), D-04 (in-app editor), D-05 (v1 playable end to end), D-12 (free — governing), D-13 (public), D-14 (name «لعبة نوف»).

**Scope of my authority here:** what happens in the room. Where the expert's engineering optimum and the majlis optimum diverge, I rule for the room and say so explicitly (that happens in rulings 3, 6 and 8).

**Nothing in this report is blocked on the user.** Eight rulings, all binding. I flag no escalation.

---

## Ruling 1 — Turn model: R4 (app alternates; "directing" is a real, staged act)

**My ruling.** Adopt R4: the app selects the next question from a flat deck, the turn to *be quizzed* alternates strictly, and the "directing" is preserved as a **named job for the non-answering team — they read the question aloud off the shared screen to their opponents.** The directing team's name appears on the question screen every single round. This costs **zero extra operator taps** (2 taps per question stands) and **zero extra authoring dimensions**.

Three implementation constraints follow, and they are not optional:

1. **The turn hand-off is an animation, not a state and not a tap.** On entry to the question screen, a full-width overlay holds ~1.5 s: «فريق ⟨أ⟩ يوجّه السؤال ← فريق ⟨ب⟩ يجاوب». It then dissolves into the question and leaves a permanent header strip carrying the same two names for the whole question. Tapping anywhere skips it instantly. No media playback begins until the overlay has cleared.
2. **The correct option must be visually indistinguishable from the others before reveal** — no ordering tell, no marker, no differing DOM class, nothing an operator's eye or a curious relative's eye can pick up. This is load-bearing precisely *because* the directing team reads the screen aloud, and it is what lets the operator be a member of a playing team (in a ten-person majlis he usually is).
3. `selectNextQuestion(state)` stays one function, and the question record carries unused optional `category` / `difficulty` from day one — I adopt the expert's §1.4 forward-compatibility clause verbatim as part of this ruling. Adding a pick-board later must never be a migration of the author's existing pack.

**Why.** The user described the authoring model in the same breath as the turn model, and it has no second dimension — no categories, no difficulty tiers, no grid. R2/R3/R5 all silently invent one and then require the *teams* to interact with a screen only the operator touches, which means a relayed negotiation and a third tap, thirty times a night, performed by a non-technical relative in front of an audience. But the phrase «يوجّه السؤال» describes a social act, and a version where that act vanishes is not the game he pictured. Reading aloud restores it exactly: it is the loudest, most visible form of "throwing a question at the other team", and it costs nothing. It also does the single most useful thing available for the trailing team — gives them a job on every round they are not answering, which is the real defence against a blowout (see ruling 7).

**The alternative I rejected and what it costs.** R2 (pick-from-a-board): +5 min per game, +1 tap per question, and — decisively — a deck that must be a **complete grid**. One missing square breaks the board, and the author is a family member filling this in on a phone. It converts "write 30 questions" into "write exactly 30 questions arranged 5×6 with no gaps", which is how a starter deck never gets finished. It stays addable later at no cost given constraint 3.

**Impact of each option.** R4: ~27 min games, flat authoring list, ceremony preserved, nothing foreclosed. R2/R3/R5: more theatre, longer games, an authoring burden the user never signed up for, and a real chance the first night never happens because the deck was never completed.

**What the room sees.** «فريق النخبة يوجّه السؤال ← فريق الصقور يجاوب» flashes across the screen, one of the النخبة reads the question out loud, الصقور huddle. Nobody touches anything except the operator.

---

## Ruling 2 — Maze: M1 fixed drawn path, and it must still *look* like a maze

**My ruling.** M1 — one fixed, hand-drawn winding maze, N stations per team, **one step per correct answer, nobody moves on a wrong answer, turn passes**. `position === correctAnswers` is a protected identity; no v1 mechanic may break it. Every cell carries `event: null` from day one so shortcuts remain data, never a schema change.

On appearance — the user asked for a متاهة and will judge it with his eyes, so the drawing must earn the word. Four binding art rules:

1. **The corridor the tokens travel is the same shape for both teams** — two lanes of one winding corridor, or two congruent mirrored paths. Never two differently-shaped routes. Congruence is what makes "who is ahead" a glance, not a trace.
2. **Maze character lives entirely outside the travelled corridor**: walls, corners, blind alcoves, dead-end stubs, decorative junctions. Draw as much of it as the illustrator wants.
3. **A decorative dead end may never look like a road not taken.** No station markers in it, no token-width opening onto the corridor, visibly walled or shaded back. The moment someone in the room asks «ليش ما راحوا من هناك؟» the operator has to explain a mechanic that does not exist — and the whole project is measured on him never having to explain anything.
4. **Every station is countable, and each team card carries a number**: «٦ من ١٠» and «بقي ٤ خطوات». The drawing carries the charm; the number carries the truth from five metres.

**Why.** M1 is the only model where the board *is* the scoreboard and the only model where a loss is unambiguously the teams' own answers. In a majlis that is not an aesthetic preference — it is what stops an argument. M2 collapses on inspection (equal branches = M1 with extra code; unequal branches = two identical teams finishing at different times because of geometry). M3 changes the board every night, so nobody ever learns to read it, it cannot be hand-drawn so it will look plainer than the thing the user is imagining, and it buys a permanent per-seed completability tax for a feature the audience does not consume. M4 (traps/shortcuts) produces the single worst outcome available in a family setting: **a team that answered better and lost to a square**, and it happens visibly, on the shared screen, in front of everyone. That is where resentment forms.

**The alternative I rejected and what it costs.** M4-as-a-layer was the tempting one — it is the loudest option, and loud is usually right in a majlis. It costs: the position/score identity, the "why did they move?" legibility, a new termination proof per event type, and a class of ending nobody accepts. Forward-only events (shortcut, bonus step) remain addable later as pure data if the user asks after a real night; back-steps and traps are refused now and later.

**Impact of each option.** M1: one illustration, one completability assertion, board readable from metres, loss attributable to answers. M3: days of generator/validator work, a plainer machine-drawn board, worse legibility every game after the first. M4: big reactions and a real chance the night ends with «هذي ما هي عدل».

**What the room sees.** One drawn maze on screen. Two tokens in the same corridor. Somebody glances up from their phone and knows the score in half a second.

---

## Ruling 3 — End fairness: R-b (equal attempts) + decider, and the decider is a *feature* — staged as one

**My ruling.** Adopt R-b: when a team reaches N, the other team gets its balancing attempt so both end on exactly equal attempts (at most **one** balancing turn ever, since `|attempts[A] − attempts[B]| ≤ 1` always holds). If both stand at N, the game goes to **«سؤال الحسم»**. Plus a visible seeded draw for who starts.

The always-a-decider consequence is a **feature**, and I rule it so — but only under four staging conditions, without which it becomes exactly the anticlimax the mandate worries about:

1. **It is announced at setup, before the first question**, in one line on the setup screen: «إذا وصلوا النهاية سوا → سؤال الحسم». A decider the room was told about is a promised climax. A decider the room meets for the first time at minute 27 is the app failing to pick a winner.
2. **No victory staging fires when the first team reaches N.** The token arrives, and the screen says «فريق ⟨أ⟩ وصل النهاية — وفريق ⟨ب⟩ له محاولة أخيرة». No confetti, no win sound, no "فاز". Celebrating and then un-celebrating is worse than not celebrating; this is the single most damaging thing that can go wrong in R-b and it is pure presentation.
3. **The decider is played in pairs, not sudden-death-in-order.** One round = one question to each team, different questions. If exactly one is correct, that team wins. Otherwise, next pair. This keeps attempts equal at every instant, which is the whole point of R-b, and it removes any information leak from two teams answering the same question on one shared screen.
4. **The decider reverses the order** — whoever went second in the main game answers first in the decider. Under pair rounds this changes no probability; it changes how it feels, and it closes the last "they always go first" complaint available to anybody in the room.

**Reserved decider questions come from the setup arithmetic, not from an authoring flag** (see ruling 5). The author is never asked to tag a question as a tiebreak question — that is a second authoring dimension by the back door, and I refuse it for the same reason I refused R2.

**Why.** The expert's finding is real and it is the highest-stakes item in this project: under immediate win, going first wins ≈55.7 % of games at N=10, p=0.7. Nobody in the majlis will compute that. What they will do is notice, once, that «خلصوا قبل ما ياخذ دورنا الأخير» — and from that moment the game is "the one where whoever starts wins", which is a verdict a family game does not survive. R-b costs two states and buys a number the operator can say out loud: **you both got exactly the same number of chances.** And on the "always a decider" worry: it is not always — it is roughly 11 % of games at p=0.7 and ~25 % at p=0.9. Those are the games where both teams played brilliantly. Ending a brilliant game on one loud question with the whole room leaning in is the best ending this game has. The defect version of that sentence is "the app couldn't decide, so here's overtime" — and the difference between the two is entirely conditions 1 and 2 above, which cost nothing.

**The alternative I rejected and what it costs.** R-a (immediate win) costs zero engineering and buys a 5.7-point structural bias plus the specific moment — losing before your last turn — where a family game gets called rigged. Rejected. Also rejected: a coin-flip or "the leader on countback" resolution of a level finish. It is quiet, it is over in one second, and it wastes the best moment the game has.

**Impact of each option.** R-b: +1 min per game, 2 states, ~11–25 % of nights end on a decider question, turn order provably 50/50, and the ending is an event. R-a: simpler, faster to build, and the first person to notice the pattern poisons the game.

**What the room sees.** الصقور's token lands on the last station. Nobody cheers yet, because the screen says النخبة still have one last attempt. النخبة get it. Both tokens at the end. The screen goes to a different colour and says **«سؤال الحسم»**. Ten people stop talking at once.

---

## Ruling 4 — Timer: none in v1, and no clock of any kind on screen

**My ruling.** No per-question countdown in v1. No stopwatch, no elapsed-game clock, no "average time" readout — nothing that ticks anywhere on the screen. **But the event log timestamps every transition silently**, so the timing debt (`question-cycle-timing-unmeasured`) is paid automatically on the first real night with zero UI.

Reopening condition, written down now so the later decision is evidence-based: add a countdown only if, across **two real sessions**, measured median deliberation exceeds **45 s** *and* that is what is pushing games past 35 minutes — not media.

**Why.** The expert's decisive argument holds and I endorse it from the room's side: under this ruleset a timeout produces exactly what the operator already produces by tapping — nobody moves, turn passes. The timer therefore buys no state, only social pressure, and the operator already holds that power with a warmer instrument (his own voice). Against that: it imports the only real-time subsystem in the app, it collides head-on with a 30-second video question, and it presses hardest on the two groups in this specific room you least want to press — the children and the elderly. A family game that makes a grandmother feel rushed has failed at something more important than pacing.

**The alternative I rejected and what it costs.** A manual count-up stopwatch the operator may start: one button, no new state — and one more control a non-technical operator must learn to ignore while ten people watch him. Rejected. Silent instrumentation gets the same data with no control at all.

**Impact of each option.** No timer: warm pacing, media questions work identically to text questions, session length varies ±10 min. Timer: predictable length, meaningful build and test cost, the fiddliest media integration in the app, and a colder room.

**What the room sees.** Nothing ticking. The team takes as long as it takes; the operator taps when they have decided.

---

## Ruling 5 — Track length: presets 6 / 10 / 14, default chosen *by the deck*, never a dead game

**My ruling.** Three presets at setup — **٦ «قصيرة» · ١٠ «عادية» · ١٤ «طويلة»** — one control, no rules change. The app **pre-selects for the operator**: the largest preset the current deck comfortably supports, capped at ١٠. He can override.

Deck bands, computed at setup from the deck size `D` (green ≈ p 0.6 plus a 4-question decider reserve; hard floor = a perfect game plus one decider pair):

| Band | Condition | Behaviour |
|---|---|---|
| Green | `D ≥ 3.34·N + 4` (N=6 → 24 · N=10 → 38 · N=14 → 51) | Preset offered normally |
| Warn | `2N + 2 ≤ D < 3.34·N + 4` (N=10 → 22…37) | Offered, with one plain line: «أسئلتك ⟨٢٦⟩ — تكفي غالباً، وإذا كثرت الأخطاء ممكن تخلص الأسئلة قبل ما يوصل أحد» |
| Refuse | `D < 2N + 2` | Preset disabled, with «أسئلتك ⟨١٨⟩ — تكفي لمسار ٦ خطوات» |

**Why.** N=10 sits inside the 20–35 minute band for p ∈ [0.6, 0.8] and the band itself is right: a seated mixed-age majlis holds one shared screen for roughly that long, and **two 25-minute games beat one 50-minute game** — the losing team gets a rematch, which is worth more socially than a longer single contest. The reason I am *not* leaving the preset to the operator's judgement is the expert's §3.5 finding, which is the least intuitive number in the whole project: a "standard 10-station game" can consume 50 questions if the teams struggle. No family member writing questions on a phone will ever guess that. The failure it produces — the deck dying at minute 22 with both teams mid-maze — is exactly the "no breakdown" clause of the success bar. The bands make that arithmetic the app's problem, not his.

I refuse a hard block above the floor. Someone with 24 questions who wants a long game gets a warning and gets to play; the app is not the referee of his evening. Below the floor the game *cannot* finish, so it is refused with a number and a suggestion, never an error.

**The alternative I rejected and what it costs.** Gating on worst-case accuracy (p=0.4, N=10 → 50 questions) would tell a man with a fresh 30-question deck that he can only play the short game. That is technically defensible and socially wrong — it makes the app feel stingy on the first night, which is the night that decides whether this project gets used again. Deck exhaustion is a *handled ending* (ruling 6), so it does not need to be prevented at any cost.

**Impact of each option.** Deck-aware default: the operator picks nothing and the game fits his deck. Fixed default of 10: some first nights die mid-maze. Worst-case gating: the first night is short and the app feels mean.

**What the room sees.** The operator taps «ابدأ». He never does arithmetic. If he reaches for «طويلة» with a thin deck, one warm sentence tells him what might happen.

---

## Ruling 6 — Deck exhaustion: the app never shrugs; a draw is a human decision, not a verdict

**My ruling.** Three endings when the unused pool empties:

1. **Positions differ → the leader wins, with full victory staging.** «فاز فريق ⟨أ⟩ بالتقدّم — ٧ مقابل ٥». Same confetti, same sound, same screen as any other win. It is a win, not a lesser outcome, and it must not look like one.
2. **Positions equal → «سؤال من الحضور».** The screen does **not** say تعادل. It shows one screen with the two team names and two big buttons — «فريق ⟨أ⟩ جاوب صح» / «فريق ⟨ب⟩ جاوب صح» — and one line: «سؤال أخير من الحضور — أول فريق يجاوب صح يفوز». The operator or any neutral person asks a question out loud, the room judges, he taps. No deck needed, no authoring, no new question content.
3. **`draw` remains reachable, but only through a third small button — «نعلنها تعادل»** on that same screen. So a draw is something the room chose, never something the app announced.

Plus one early-warning rule: when the unused pool drops below **8**, a small «باقي ⟨٦⟩ أسئلة» pip appears next to the maze. Discreet, needs no explanation.

**Why — and this is where I diverge from the engineering optimum.** The expert's model is correct and I keep all of it: `outcome ∈ {winA, winB, draw}`, draw reachable, termination proven. What I refuse is the *presentation* of the draw. "الشاشة تقول تعادل" in a majlis is not a state transition, it is ten people looking at each other with nothing to do next; the evening ends on a shrug, and the operator — who has just spent 27 minutes as the host — is the one holding it. Handing the decider to the room costs one screen with three buttons and turns the worst ending in the state machine into the most social moment of the night. It is also what a majlis does *anyway* when a game ends level; the app is just not getting in the way. And the countdown pip matters more than it looks: an ending that arrives without warning feels arbitrary, an ending you could see coming for two minutes feels earned.

**The alternative I rejected and what it costs.** Letting the app declare تعادل directly: zero build cost, and it is the only ending in this design that leaves the room flat. Also rejected: re-asking an already-used question as a decider — it breaks the no-repeat invariant (I3), and "the app ran out of questions" is visible to everyone the moment a repeat appears on screen.

**Impact of each option.** Room-decider: exhaustion becomes a finish, the invariants survive, one extra screen. App-declares-draw: one less screen, and the one ending nobody remembers fondly.

**What the room sees.** The pip has been counting down for two minutes. The last question is used, both teams are at ٥. The screen says «سؤال أخير من الحضور». Somebody's uncle asks something about a wedding in 2009 and the whole room shouts at once.

---

## Ruling 7 — Landslide: no mechanic. The rematch is the comeback.

**My ruling.** No catch-up mechanic in v1 — no comeback cells, no difficulty weighting, no steal, no track shortening, no wager. The blowout is handled entirely by presentation, and by the fact that it is over in about thirteen minutes.

What the screen does at 6–0, precisely:

1. **Both teams' cards show «بقي ⟨X⟩ خطوات», never a percentage and never a chance-to-win.** "بقي ٤ / بقي ١٠" is a target. A token parked at the start next to a number is a verdict.
2. **The trailing team's name is on the screen every single round** as the directing team (ruling 1). They have a job on every question they are not answering. This is the whole reason the reading ceremony is worth preserving.
3. **No consolation copy mid-game.** No «حاولوا مرة ثانية», no encouraging animation for the trailing team, no easier-looking question. In front of family, pity is worse than losing.
4. **The end screen shows both teams' correct counts** — honest, and it tells the game's author his deck was lopsided, which fixes the cause instead of masking it.
5. **One big «لعبة جديدة» button, and the rematch defaults to the losing team going first**, said out loud on screen: «نفس الفريقين — يبدأ فريق ⟨ب⟩». Under R-b turn order is provably fairness-neutral, so this courtesy costs exactly nothing and reads as generosity.

No mercy rule, no early termination. At N=10 the maximum lead after k rounds is exactly k, so the blowout self-terminates when the leader arrives — roughly minute thirteen. Ending it earlier saves nothing and announces to the trailing team that the app gave up on them.

**Why.** A 6–0 gap means one team answered six of six wrong. That is almost always an *authoring* mismatch — the deck suits one side's knowledge — and no rule can fix an authoring problem; it can only disguise it. Every disguise has a price paid in front of everyone: comeback cells overtake the leading team by board decree, on the shared screen, which is the exact geometry of resentment; difficulty weighting is either a lie the operator must maintain or a public statement that one team needs easier questions. The real damage of a blowout is not unfairness, it is the trailing team going quiet — and that is fixed by giving them a role and a short road to a rematch.

**The alternative I rejected and what it costs.** Wager (option E — «نراهن بخطوتين») is the only assisted mechanic whose outcome stays attributable to the team's own choice, and it is genuinely dramatic. It costs a position floor, a termination bound, a new state and a new prompt, and — more to the point — it puts a strategic decision in front of teams who came to answer questions about their cousins. It stays on the shelf as the *only* catch-up mechanic I would ever endorse, after a real night, if the user asks.

**Impact of each option.** Nothing: zero fairness cost, blowouts end fast, rematch absorbs them. Comeback cells: closer scores, and one team overtaken by the board in public. Wager: real drama, real build cost, a rule the operator must explain — against the success bar.

**What the room sees.** الصقور are at ٦, النخبة at ٠. النخبة are still reading every question aloud, both cards say how many steps remain, and thirteen minutes in there is a big button that says «لعبة جديدة — يبدأ فريق النخبة».

---

## Ruling 8 — Media before options (my domain, added because the planner will otherwise guess)

**My ruling.** For **audio and video questions only**, the options stay hidden during the first playback. They auto-reveal when playback ends, and an always-present «اعرض الخيارات» button lets the operator reveal them at any moment — so a failed `ended` event is never a dead end, just an extra tap. For **text and image questions the options appear immediately** with the question; no phasing, no extra tap.

**Why.** Four Arabic options on screen during a 30-second clip do not wait their turn — people read them instead of watching, then the clip ends and nobody saw it. That converts the project's most expensive content (video, the one thing straining the free-hosting budget under D-12/D-13) into the most confusing content. Images do not have this problem: a picture and four options can be taken in together. This is one rule, applied to two media types, and it protects the questions the author worked hardest on.

**The alternative I rejected and what it costs.** Options always visible: zero build cost, and every video question is watched by half the room. A separate `MEDIA_PLAYING` state: correct on paper, but it hands the expert's own §8.2 hazard — unreliable `ended` across autoplay policies and codecs — the power to freeze the game live. Keeping this as two visual phases inside one state, with a manual escape hatch, means the worst case is one extra tap, not a stuck screen.

**Impact of each option.** Phased: media questions land, one optional tap. Unphased: cheaper to build, and the most memorable questions get half-watched.

**What the room sees.** The video plays and everyone actually watches it. It ends, four options slide in, الصقور start arguing.

---

## Endorsed without reopening (the expert's calls I am ratifying from the room's side)

| Item | Position |
|---|---|
| Wrong answer → nobody moves, turn passes | **Endorsed.** It is the only policy preserving `position === correctAnswers`, which is what makes the maze readable and the game explainable in one sentence. "Steal" stays a v2 candidate |
| Always-visible «تراجع», unlimited, undoing one committed transition | **Endorsed, and I raise its priority.** The operator mis-tapping in front of ten people is the single most likely way the success bar («بلا شرح تقني») is lost. It must be the *only* recovery word he ever needs |
| Append-only event log as the state model | **Endorsed** — it is what makes undo correct including the returned question, and it pays for persistence and the timing instrumentation in ruling 4 at the same time |
| Explicit resume prompt, never auto-resume, never auto-discard | **Endorsed.** Both silent behaviours destroy an evening; the prompt costs one screen |
| Visible seeded draw for who starts | **Endorsed** — under R-b it is theatre, and it is good theatre; the room saw the draw happen |
| Two games in one night reuse questions (used-set resets per game) | **Endorsed**, and it must be *stated* on the new-game screen, not discovered: «الأسئلة ترجع من أولها» |

---

## BINDING DECISIONS TABLE

For `سجل-القرارات.md` under **D-09**. The coordinator translates the ruling and reason columns into Arabic; the **on-screen Arabic strings are literal and must not be paraphrased.**

| # | Decision | Ruling | One-line reason |
|---|---|---|---|
| D-09.1 | Turn model | **R4** — app picks from a flat deck, turn to answer alternates strictly; the non-answering team is named on screen and **reads the question aloud**; hand-off is a ~1.5 s skippable overlay, not a state and not a tap (2 taps/question stands) | Preserves the "each team directs the question" feeling the user described at zero mechanical and zero authoring cost |
| D-09.2 | Pre-reveal secrecy | The correct option is **visually indistinguishable** from the others until reveal — no marker, no ordering tell | The directing team reads the screen aloud, and the operator is usually on a team |
| D-09.3 | Forward compatibility | Question record carries unused optional `category` + `difficulty` from day one; selection lives only in `selectNextQuestion(state)` | Adding a pick-board later must never migrate the author's existing pack |
| D-09.4 | Maze model | **M1** — one fixed drawn maze, N stations per team, one step per correct answer; every cell `event: null` | Position equals correct answers, so the board is a scoreboard readable from five metres |
| D-09.5 | Wrong answer | Nobody moves, the turn passes. No steal, no penalty in v1 | Only policy that preserves `position === correctAnswers` |
| D-09.6 | Maze appearance | Both teams travel a **congruent** corridor; maze character (walls, corners, blind alcoves, dead-end stubs) lives **outside** the travelled corridor; decorative dead ends carry no stations and no token-width opening; stations countable, each card shows «٦ من ١٠» and «بقي ٤ خطوات» | It must look like a متاهة, and a decoration that looks like a mechanic forces the operator to explain something that does not exist |
| D-09.7 | End fairness | **R-b** — equal-attempts completion (at most one balancing turn), then **«سؤال الحسم»**; visible seeded first-turn draw | Immediate win gives the first team ≈55.7 % at N=10, p=0.7 — a bias a family game does not survive once noticed |
| D-09.8 | The decider is a feature | Announced at setup («إذا وصلوا النهاية سوا → سؤال الحسم»); **no victory staging when the first team reaches N** — only «فريق ⟨أ⟩ وصل النهاية — وفريق ⟨ب⟩ له محاولة أخيرة» | Celebrating then un-celebrating is the one presentation error that would make R-b feel rigged |
| D-09.9 | Decider format | Played in **pairs** (one different question to each team per round); exactly one correct → that team wins; otherwise next pair. **Order reverses** — whoever went second in the game answers first in the decider | Keeps attempts equal at every instant, removes the information leak of two teams hearing one question, and closes the last "they always start" complaint |
| D-09.10 | Decider questions | Drawn from the same unused pool with a **4-question reserve enforced by the setup arithmetic**. **No authoring flag.** The author is never asked to tag a tiebreak question | A second authoring dimension by the back door is exactly what R4 was chosen to avoid |
| D-09.11 | Timer | **None.** No countdown, no stopwatch, no elapsed clock anywhere. Event log timestamps every transition **silently**. Reopen only if two measured sessions show median deliberation > 45 s driving games past 35 min | A timeout produces what the operator's tap already produces; it buys only pressure, aimed at the children and the elders |
| D-09.12 | Track length | Presets **٦ قصيرة · ١٠ عادية · ١٤ طويلة**; app pre-selects the largest preset the deck supports, capped at ١٠ | ~27 min at N=10; two 25-min games beat one 50-min game |
| D-09.13 | Deck bands at setup | Green `D ≥ 3.34N + 4` · Warn `2N+2 ≤ D < 3.34N+4` (offered, one plain sentence) · Refuse `D < 2N+2` (disabled, with a suggested N) | A "standard" game can consume 50 questions; no family author will guess that, and the app must never start a game that cannot finish |
| D-09.14 | Exhaustion, unequal | Leader wins with **full victory staging** — «فاز فريق ⟨أ⟩ بالتقدّم — ٧ مقابل ٥» | It is a win; presenting it as a lesser outcome invents a grievance |
| D-09.15 | Exhaustion, level | **«سؤال من الحضور»** — one screen, two buttons («فريق ⟨أ⟩ جاوب صح» / «فريق ⟨ب⟩ جاوب صح»), a neutral person asks aloud. `draw` reachable **only** via a third button «نعلنها تعادل» | The app never shrugs at the room; a draw becomes something people chose |
| D-09.16 | Exhaustion warning | A small «باقي ⟨٦⟩ أسئلة» pip appears once the unused pool drops below 8 | An ending you saw coming feels earned; one that arrives unannounced feels arbitrary |
| D-09.17 | Landslide | **No mechanic.** Both cards always show «بقي X خطوات» (never a percentage or win-chance); trailing team keeps the directing role every round; no consolation copy mid-game; end screen shows both correct counts | The damage is disengagement, not unfairness — and every catch-up mechanic overtakes the leading team by decree, in public |
| D-09.18 | The rematch is the comeback | One big «لعبة جديدة»; rematch **defaults to the losing team going first**, stated: «نفس الفريقين — يبدأ فريق ⟨ب⟩». New-game screen states «الأسئلة ترجع من أولها» | Under R-b turn order is fairness-neutral, so the courtesy is free and reads as generosity |
| D-09.19 | Media before options | Audio + video: options hidden during the first playback, auto-revealed on end, with an always-present «اعرض الخيارات» escape. Text + image: options immediate | Four options during a 30-second clip means half the room never watches the clip |
| D-09.20 | Escalation | **None.** All of D-09 is ruled here under full-run mode | — |

**Not mine, routed:** deck/media/session storage mechanics → `media-storage-expert`; what the maze *looks like* pixel-for-pixel, the «بقي X خطوات» card, contrast and font scale for five-metre reading → `rtl-stage-ux-expert`; state machine, invariants, completability proof, `P(first team wins)` measurement → `game-systems-expert`; what ships in v1 vs later → `scope-advisor`; export/import and video weight → `durability-advisor`. All via the coordinator.

---

## What the first playable night looks like

The screen is the TV in the majlis. Someone's laptop or phone is plugged in; the operator has the remote or is sitting nearest the machine. He opens the link. He taps «لعبة جديدة».

He types two team names. The app says his deck has ٣٢ سؤالاً and has already selected «عادية — ١٠ خطوات» for him; he does no arithmetic. One line under it: «إذا وصلوا النهاية سوا → سؤال الحسم». He taps ابدأ.

The two names spin for two seconds and the screen says فريق النخبة يبدأ. Everybody saw it happen; nobody thinks the app chose a favourite.

Then the maze — one winding drawn corridor with walls and blind alcoves, ten stations, two tokens sitting at the start. Across the top: **«فريق النخبة يوجّه السؤال ← فريق الصقور يجاوب»**. The banner dissolves into the question and one of النخبة reads it out loud, because the screen told him to. Four options. الصقور argue for fifteen seconds, settle on the third one, the operator taps it. The right answer lights up green, the wrong one they picked lights up red, the room reacts, and the الصقور token slides one station forward. Their card now says «١ من ١٠ — بقي ٩». Two taps, and the banner has already flipped: الصقور are now directing.

Around question twelve there is a video question. The clip plays with nothing competing against it; when it ends the four options slide in. Somebody's mother gets it right and the room shouts.

Around minute twenty the operator taps the wrong option — الصقور said الثاني and he hit الثالث. He taps «تراجع» once. The token comes back, the question comes back, the room laughs at him for four seconds. Nothing is explained.

Minute twenty-six: النخبة's token reaches the last station. There is no confetti. The screen says **«فريق النخبة وصل النهاية — وفريق الصقور له محاولة أخيرة»** and the room, which was told this at setup, turns to الصقور. الصقور get it. Both tokens at the end.

The screen changes colour: **«سؤال الحسم»**. Because الصقور went second all night, they answer first this time. They miss it. النخبة get theirs right. Now the confetti, now the sound, now the screen: **فاز فريق النخبة**, both teams' correct counts underneath — ١٠ و١٠ في المسار، والحسم للنخبة.

Twenty-eight minutes. One big button: **«لعبة جديدة — يبدأ فريق الصقور»**. Somebody reaches for it before the operator does.
