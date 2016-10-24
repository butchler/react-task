import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import deepEqual from 'deep-equal';

import { task, withTasks } from 'src';
import generate from 'src/generate';

const state = { counters: [] };
const appContainer = document.getElementById('app-container');

function render() {
  ReactDOM.render(<App state={state} />, appContainer);
}

function App({ state }) {
  return (
    <div>
      <p><button onClick={addCounter}>Add Counter</button></p>

      <ul>
      {state.counters.map((counter, index) =>
        <li key={index}>
          <CounterWithTasks counter={counter} index={index} />
        </li>
      )}
      </ul>
    </div>
  );
}

function Counter({ counter, index }) {
  return (
    <div>
      Counter {index}: {counter.count} <button onClick={() => removeCounter(index)}>Remove</button>
    </div>
  );
}

const CounterWithTasks = withTasks(props => [
  task(counterTask, { index: props.index, delay, incrementCounter }),
])(Counter);

function counterTask(getProps, prop$) {
  const { index, delay, incrementCounter } = getProps();

  return generate(function* () {
    try {
      while (true) {
        yield delay(1000);
        incrementCounter(index);
      }
    } finally {
      console.log('stopped');
    }
  });
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

function delay(ms) {
  return new Observable(observer => {
    const timeout = setTimeout(() => {
      observer.next(ms);
      observer.complete();
    }, ms);

    return () => clearTimeout(timeout);
  });
}

render();
