import 'babel-polyfill';

import { runProc, call, callMethod } from 'src/proc';
import { delay } from 'src/promises';

function* counter(timeout) {
  let count = 0;

  try {
    while (count < 5) {
      yield call(delay, timeout);
      count += 1;
      yield callMethod(document, 'write', `Count: ${count}<br>`);
    }
  } finally {
    if (count < 5) {
      yield callMethod(document, 'write', 'Counter was cancelled before it ended.<br>');
    }

    yield callMethod(document, 'write', 'delaying end<br>');
    yield call(delay, 1000);
    yield callMethod(document, 'write', 'actual end<br>');
  }
};

runProc(counter, 500).then(() => {
  // Start another process when the first one ends, but stop it prematurely.
  const proc = runProc(counter, 500);
  delay(1000).then(proc.cancel);
});
