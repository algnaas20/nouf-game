# بروتوكول: `tsx` + Playwright `page.evaluate` — the `__name is not defined` trap

**المالك:** WL-C (المحرِّر والوسائط) · **تاريخ الكتابة:** 2026-08-08، بعد أول تشغيل حقيقي أعطى الخطأ ثم أُصلح وأُعيد تشغيله بنجاح (PH-C2) — لا قبل ذلك (v3 §8).
**اللغة:** إنجليزية للتفاصيل التقنية (جمهورها الوكلاء)؛ هذا السطر فقط عربي للفهرسة.

**Debt discharged:** an environment trap discovered mid-session while writing `tests/editor/live/media-intake.ts` — documented here so no future line re-diagnoses it from scratch.

---

## The symptom

Running a Playwright script via `npx tsx some-script.ts`, any `page.evaluate(async () => { ... })` call whose callback contains an **internal named function or arrow binding** fails instantly with:

```
page.evaluate: ReferenceError: __name is not defined
```

The stack trace points into Playwright's internal `UtilityScript.evaluate`, evaluating the serialized callback — not into any of your own application code (IndexedDB, canvas, DOM APIs are all innocent; this fires before any of that runs).

## Minimal repro

```ts
const r = await page.evaluate(async () => {
  const helper = (x: number) => x + 1; // <- this line is the whole problem
  return helper(41);
});
```

A callback with **no internal named binding** — e.g. `page.evaluate((n) => document.querySelectorAll('.x').length === n, 5)` — never hits this. This is exactly why earlier PH-C1 live scripts (`tests/editor/live/persistence-and-quota.ts`) never encountered it: every one of their `evaluate` callbacks is a single-expression, unnamed arrow.

## Root cause

`tsx` transpiles `.ts` files through esbuild before Node ever runs them. esbuild's `keepNames`-style output injects a helper — commonly surfaced as `__name(fn, "name")` — that wraps named function/arrow *bindings* so their `.name` property survives minification/bundling (useful for stack traces in the transpiled Node process itself).

Playwright's `page.evaluate(fn, ...)` does **not** send your module to the browser. It calls `fn.toString()` on the already-transpiled JS function object and evaluates **only that extracted source text**, standalone, inside the page's JS context. Any reference inside that extracted text to a helper (`__name`) that lived in the *surrounding module scope* of the tsx-compiled file — not inside the function itself — is now undefined, because the browser never received that surrounding scope.

**This is specific to code paths on the Node side that go through tsx's transpilation.** Vite's dev-server transform (used for everything the browser loads directly, including via `import()` from inside the page) does not exhibit this, because in that case the whole module — helper included — genuinely ships to and runs in the browser as one unit; nothing gets extracted and evaluated in isolation.

## The fix that works

**Never write nontrivial in-browser logic inline inside a `page.evaluate` callback in a tsx-run script.** Instead:

1. Put the real logic (fixture generation, calls into your app's real modules) in a separate `.ts` file that Vite serves normally (e.g. `tests/editor/live/browser-fixtures.ts`), using ordinary static `import`s for anything from `src/**` — this way `tsc --noEmit` can still type-check it like any other project file.
2. From the Node-side script, `import()` that file **from inside the page** via a *non-literal* specifier (a string variable, not a string-literal argument), so `tsc` does not attempt (and fail) to resolve `/an/absolute/browser/path.ts` as a module for type-checking:
   ```ts
   const FIXTURES_MODULE = '/tests/editor/live/browser-fixtures.ts';
   const result = await page.evaluate(
     async ({ modulePath, arg }) => (await import(modulePath)).someExportedFn(arg),
     { modulePath: FIXTURES_MODULE, arg: 123 },
   );
   ```
3. Keep every remaining `page.evaluate` callback in the tsx-run script itself **trivial** — a one-line dispatcher with no internal named bindings.

This was applied to `tests/editor/live/media-intake.ts` (moved all fixture/pipeline-invocation logic into `tests/editor/live/browser-fixtures.ts`) and confirmed working end-to-end: all four AC1–AC4 scenarios ran and passed after the change (see `docs/تأسيس-المشروع/تقارير/المنفِّذ/worklog-C2.md`).

## What did *not* work / was not worth pursuing further

- A workaround of pre-defining `globalThis.__name` inside the evaluate callback does not help — the `__name(...)` calls are injected *around* named bindings throughout the callback's compiled body, including potentially before any line of your own code runs, and reasoning about exactly where esbuild inserts them is fragile and version-dependent. Restructuring to avoid named bindings entirely (via the module-split approach above) is more robust and does not depend on esbuild internals staying the same across versions.
- Disabling `tsx`'s name-keeping behavior via a config flag was not investigated — the module-split fix is strictly better anyway, since it also means the fixture/pipeline logic is real, type-checked, Vite-served code exercising the actual dev pipeline, not code that only ever runs inside a special Node-side transpilation context.

## A separate, unrelated observation from the same session (not this bug)

While diagnosing the above, a **minimal repro script hung indefinitely** (`chromium.launch()` succeeded — confirmed via real `chrome-headless-shell` processes in `Get-Process` — but nothing progressed for minutes, no error, no output) on two separate attempts, and had to be killed manually (by PID, never a blind `taskkill`). The *actual* target script (`media-intake.ts`), run immediately after, executed every `page.evaluate` call in well under a second. This looked like incidental environment flakiness (possibly orphaned-process contention from the first killed attempt) rather than anything related to the `__name` bug, and was not investigated further since the real script gave conclusive, fast, repeatable evidence on its own. If a future session sees a `page.evaluate`/`chromium.launch()` script hang with **zero output at all** (not even a first `console.log`), check for orphaned Chromium/node processes from a previous killed attempt before assuming a new bug.
