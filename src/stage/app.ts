import { DemoSession, DEMO_TEAM_NAMES } from './demo/session';
import { renderHomeScreen } from './screens/home';
import { renderQuestionScreen } from './screens/question';
import { renderWinnerScreen } from './screens/winner';

/** No client-side router (D-11) — a plain state switch inside one root element. */
export function mountApp(root: HTMLElement): void {
  const session = new DemoSession();
  let screen: 'home' | 'question' | 'winner' = 'home';

  const wrap = document.createElement('div');
  wrap.className = 'stage-root';
  root.append(wrap);

  function render(): void {
    if (screen === 'home') {
      renderHomeScreen(wrap, {
        onStart: () => {
          screen = 'question';
          render();
        },
      });
      return;
    }

    if (screen === 'winner') {
      renderWinnerScreen(wrap, {
        teamNames: DEMO_TEAM_NAMES,
        scores: session.state.scores,
        canUndo: session.canUndo(),
        onRestart: () => {
          session.restart();
          screen = 'question';
          render();
        },
        onUndo: () => {
          session.undo();
          screen = 'question';
          render();
        },
      });
      return;
    }

    if (session.state.finished) {
      screen = 'winner';
      render();
      return;
    }

    renderQuestionScreen(wrap, {
      question: session.currentQuestion(),
      optionOrder: session.state.optionOrder,
      teamNames: DEMO_TEAM_NAMES,
      answeringTeam: session.state.answeringTeam,
      scores: session.state.scores,
      revealed: session.state.revealed,
      chosenOption: session.state.chosenOption,
      canUndo: session.canUndo(),
      onChoose: (optionIndex) => {
        session.chooseOption(optionIndex);
        render();
      },
      onNext: () => {
        session.nextQuestion();
        render();
      },
      onUndo: () => {
        session.undo();
        render();
      },
    });
  }

  render();
}
