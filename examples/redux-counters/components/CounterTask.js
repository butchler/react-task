import React from 'react';
import { Task, call } from 'src';
import { callMethod } from 'src/proc';
import { delay } from 'src/promises';

function* counterTask(getProps) {
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

export default function CounterTask(props) {
  return <Task generator={counterTask} {...props} />;
}
