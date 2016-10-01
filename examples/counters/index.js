import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import deepEqual from 'deep-equal';

import { task, call, callMethod } from 'src';
import { delay } from 'src/promises';
import { mockCalls, runSync, PROC_RETURN } from 'src/proc';

const state = { counters: [] };
const appContainer = document.getElementById('app-container');

function render() {
  ReactDOM.render(<App state={state} />, appContainer);
}

function App({ state }) {
  const counterList = state.counters.map((counter, index) => {
    return (
      <li key={index}>
        Counter {index}: {counter.count} <button onClick={() => removeCounter(index)}>Remove</button>

        {/**
          * NOTE: In this example, the Task component is rendered alongside the UI components. In
          * the redux-counters example, the Tasks and UI are rendered completely independently. You
          * are free to organize the tasks how you want.
          */}
        {task(counterProc, { index })}
      </li>
    );
  });

  return (
    <div>
      <p><button onClick={addCounter}>Add Counter</button></p>

      <ul>{counterList}</ul>
    </div>
  );
}

function* counterProc(getProps) {
  try {
    const { index } = getProps();

    // It's okay to have an infinite loop inside a task as long as it yields
    // inside the loop. The Proc running the task will be stopped when the Task
    // component gets unmounted.
    while (true) {
      yield call(delay, 1000);
      yield call(incrementCounter, index);
    }
  } finally {
    // Use a finally block to perform clean up when a Task gets stopped.
    yield callMethod(console, 'log', 'Task was unmounted and stopped.');
  }
}

function addCounter() {
  state.counters.push({ count: 0 });

  render();
}

function incrementCounter(id) {
  state.counters[id].count += 1;

  render();
};

function removeCounter(id) {
  // NOTE: Because we just delete the counter at the given index, the length of
  // the array doesn't decrease so new counters always get a unique id and we
  // don't have to worry about new counters using the same id as an old,
  // removed counter.
  //
  // So in this case it works to just use an array, but in a real app you
  // should really give your tasks proper keys instead of just using an array
  // index.
  delete state.counters[id];

  render();
};

function tests() {
  // To test a single Task, you can iterate through its generator and compare
  // against the call objects it yields, just like Redux Sagas, but simpler
  // because Proc only supports call/apply effects:
  //
  // We can just pass a fake getProps function in since we'll fake its results
  // using Generator.next() anyway.
  const getProps = () => ({ index: 123 });
  const gen = counterProc(getProps);

  for (let i = 0; i < 10; i++) {
    assert(deepEqual(gen.next().value, call(delay, 1000)));
    assert(deepEqual(gen.next().value, call(incrementCounter, 123)));
  }

  // Rather than testing the generator directly, a better way to test procs is to use the
  // mockCalls() helper in react-task/proc to mock the functions that can cause side effects:
  let returned = false;
  const mockedProc = mockCalls(counterProc, {
    delay: () => 'do nothing',
    // Returning the value PROC_RETURN will cause the proc to return.
    incrementCounter: index => index === 123 && PROC_RETURN,
    log: () => returned = true,
  });

  runSync(mockedProc, getProps);

  assert(returned);
}

function assert(value) {
  if (!value) {
    throw new Error('Assertion failed');
  }
}

render();
tests();
