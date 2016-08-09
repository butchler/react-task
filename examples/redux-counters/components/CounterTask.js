import React from 'react';
import { task, call, callMethod } from 'src';
import { delay } from 'src/promises';

const CounterTask = task(function* (getProps) {
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
});

CounterTask.displayName = 'CounterTask';

CounterTask.propTypes = {
  onCount: React.PropTypes.func.isRequired,
};
