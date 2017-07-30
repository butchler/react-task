import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import deepEqual from 'deep-equal';

import { mockCalls, runSync, PROC_RETURN } from 'src/proc';
import Interval from 'src/Interval';

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
        <CounterTask index={index} />
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

class CounterTask extends React.Component {
  constructor() {
    super()

    this.onInterval = () => incrementCounter(this.props.index);
  }

  componentWillUnmount() {
    // Use componentWillUnmount to perform cleanup.
    console.log('Task was unmounted and stopped.');
  }

  render() {
    return <Interval onInterval={this.onInterval} ms={1000} />;
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
  // TODO: To test, use React's shallow rendering, or actually mount the task component with
  // something like enzyme. It maybe also be useful to use something like sinon to mock the passage
  // of time or XMLHttpRequests, etc.
}

render();
tests();
