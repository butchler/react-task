import React from 'react';
import { task, call, callMethod } from 'src';
import { delay } from 'src/promises';

export function* counterProc(getProps) {
  try {
    const { onCount } = yield call(getProps);

    while (true) {
      yield call(delay, 1000);
      yield call(onCount);
    }
  } finally {
    // Tasks can use a try {} finally {} block to do clean up when they are stopped.
    yield callMethod(console, 'log', 'Counter shutting down...');
    yield call(delay, 1000);
    yield callMethod(console, 'log', 'Counter ended.');
  }
}

export default Object.assign(
  task(counterProc),
  // The task() function returns a React component, which we can then assign a
  // custom displayName and propTypes to if we want.
  {
    displayName: 'CounterTask',
    propTypes: {
      onCount: React.PropTypes.func.isRequired,
    },
  }
);
