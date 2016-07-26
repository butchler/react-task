import 'babel-polyfill';

import Task from './src/task';
import Proc from './src/proc';
import TaskTester from './src/test';

// Examples
// --------
import React from 'react';
import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';
import ReactTestUtils from 'react-addons-test-utils';
import deepEqual from 'deep-equal';

function assert(value) {
  if (!value) {
    throw new Error('Assertion failed');
  }
}

function delay(timeout) {
  let timeoutId;

  const promise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(resolve, timeout);
  });

  promise[Proc.CANCEL_PROMISE] = () => {
    clearTimeout(timeoutId);
  };

  return promise;
}

// Proc:
function procExample() {
  const counter = function *(name, timeout) {
    let count = 0;

    while (count < 5) {
      yield Proc.call(delay, timeout);
      count += 1;
      console.log(`${name}: ${count}`);
    }

    console.log(`${name} ended`);
  };

  const proc1 = new Proc(counter, 'normal', 1000);
  proc1.start();

  const proc2 = new Proc(counter, 'stopped prematurely', 1000);
  proc2.stop();
  proc2.start();
  delay(1000).then(() => proc2.stop());
}

// Task:
function taskExample() {
  const state = { counters: [] };
  const appContainer = document.getElementById('app-container');
  const taskContainer = document.createElement('div');

  const render = () => {
    ReactDOM.render(<App state={state} />, appContainer);

    // Render the tasks in an unattached element so that they don't modify the visible DOM.
    ReactDOM.render(<AppTasks state={state} />, taskContainer);
  };

  const App = ({ state }) => {
    const counterList = state.counters.map((counter, index) => {
      return <li key={index}>Counter {index}: {counter.count} <button onClick={() => removeCounter(index)}>Remove</button></li>;
    });

    return <div>
      <p><button onClick={addCounter}>Add Counter</button></p>

      <ul>{counterList}</ul>

      {/*
        * NOTE: You could just render your tasks alongside regular components like this:
        *

      <AppTasks state={state} />

        *
        * But it's probably a bad idea, because then you won't be able to render
        * on the client without causing side effects.
        *
        * Instead it's probably better to render all of your tasks separately
        * from your UI, like in render() above.
        *
        */}
    </div>;
  };

  const AppTasks = ({ state }) => {
    const counterTasks = state.counters.map((counter, index) => <CounterTask key={index} id={index} />);

    return <div>{counterTasks}</div>;
  };

  const CounterTask = class CounterTask extends Task {
    *run() {
      const { id } = this.props;

      // It's okay to have an infinite loop inside a task as long as it yields
      // inside the loop. The Proc running the task will be stopped when the Task
      // component gets unmounted.
      while (true) {
        yield Proc.call(delay, 1000);
        yield Proc.call(incrementCounter, id);
      }
    }

    taskWasStopped() {
      console.log('taskWasStopped');
    }
  };

  //
  // If you don't need to use the taskWasStopped() method, you can just use a
  // generator function that takes the props as an argument, similar to React's
  // stateless components:
  //
  // function *CounterGenerator({ id }) {
  //   while (true) {
  //     yield Proc.call(delay, 1000);
  //     yield Proc.call(incrementCounter, id);
  //   }
  // }
  //
  // Then you can run this generator using the generic Task component:
  //
  // <Task generator={CounterGenerator} id={id} />
  //

  const addCounter = () => {
    state.counters.push({ count: 0 });

    render();
  };

  const incrementCounter = (id) => {
    state.counters[id].count += 1;

    render();
  };

  const removeCounter = (id) => {
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

  // Testing Tasks:
  function testTaskExample() {
    // To test a single Task, you can iterate through its generator and compare
    // against the call objects it yields, just like Redux Sagas, but simpler
    // because Proc only supports call/apply effects:
    const task = new CounterTask({ id: 123 });
    const gen = task.run();

    for (let i = 0; i < 10; i++) {
      assert(deepEqual(gen.next().value, Proc.call(delay, 1000)));
      assert(deepEqual(gen.next(undefined).value, Proc.call(incrementCounter, 123)));
    }

    // The same test using a helper for testing tasks:
    const taskTester = new TaskTester(<CounterTask id={123} />);

    for (let i = 0; i < 10; i++) {
      taskTester.calls(delay, 1000).calls(incrementCounter, 123);
    }

    // To test whether or not the correct tasks are being run for the given
    // state, you can just use shallow rendering to make sure the correct Task
    // components are being rendered:
    const renderer = ReactTestUtils.createRenderer();
    renderer.render(<AppTasks state={{ counters: [{ count: 123 }] }} />);
    const tasks = renderer.getRenderOutput().props.children;

    assert(deepEqual(tasks, [<CounterTask key={0} id={0} />]));
  }

  render();
  testTaskExample();
}

// Server rendering:
function serverRenderTest() {
  // Server rendering of tasks should work without causing side effects because
  // only componentWillMount gets called during server rendering.
  const ServerTaskTest = (props) => {
    const fail = function *(props) {
      throw 'fail';
    };

    return <Task generator={fail} />;
  };

  // This shouldn't throw an error:
  assert(ReactDOMServer.renderToStaticMarkup(<ServerTaskTest />) === '');

  // This should throw an error:
  try {
    console.log(ReactDOM.render(<ServerTaskTest />, document.createElement('div')));
    assert(false);
  } catch (error) {
    assert(error === 'fail');
  }
}

procExample();
taskExample();
serverRenderTest();
