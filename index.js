import 'babel-polyfill';
import React from 'react';
import deepEqual from 'deep-equal';
import clone from 'clone';

/**
 * <Task generator={...} ... />
 *
 * A Task component starts a Proc (which is basically a background process that
 * runs a generator function) when it gets mounted, and stops the Proc when it
 * gets unmounted.
 *
 * To define a Task, create a new class that extends Task and overrides the
 * *run() generator method. You may also override the taskWasStopped() method
 * if you want to do cleanup when the Task gets unmounted.
 *
 * Alternatively, you can just pass a generator function to the "generator"
 * prop, and all other props will be passed as the first argument to the
 * function.
 *
 * NOTE: A Task will only stop its Proc when it gets unmounted or the generator
 * prop is changed. To restart a Task with new props, pass a unique "key" prop,
 * which will force React to unmount the Task when the key changes.
 */
export default class Task extends React.Component {
  // React lifecycle methods
  // -----------------------

  // Start a Proc (which is basically a background process that runs a
  // generator function) when the Task component gets mounted, and stop the
  // proc when it gets unmounted.
  componentDidMount() {
    // Allow just passing in a generator function to a generic Task component
    // instead of always having to make a new class that extends Task.
    const generatorFn = this.props.generator || this.run.bind(this);

    this._start(generatorFn, this.props);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.generator !== nextProps.generator) {
      // If the generator has changed, stop the old Proc and start a new one.
      this._stop();
      this._start(nextProps.generator, nextProps);
    } else if (process.env.NODE_ENV !== 'production') {
      // If the generator hasn't changed but the other props have, consider
      // that an error, because it's not clear whether the Proc should be
      // restarted or not.
      //
      // Don't run this check on production because it requires a deepEqual
      // which could become very slow for large data structures.
      if (!deepEqual(this._propsSnapshot, nextProps)) {
        throw new Error('Task received new props with the same generator. ' +
            'To restart the Task with the new props, pass a new "key" prop. To ' +
            'pass new information to the Task during its execution without ' +
            'restarting it, yield a call to a function that returns that ' +
            'information within its generator.');
      }
    }
  }

  componentWillUnmount() {
    this._stop();
  }

  // Task components never render anything by default.
  shouldComponentUpdate() {
    return false;
  }

  render() {
    return null;
  }

  // Methods for child classes to override
  // -------------------------------------

  // Generator method that performs side effects by yielding calls to Proc.call/apply.
  *run() {
    throw new Error('Subclasses of Task must override the run() method, or a ' +
        'generator={...} prop must be passed to the Task component.');
  }

  // Called when the Task is stopped/unmounted.
  taskWasStopped() { }

  // "Private" methods
  // -----------------

  _start(generator, props) {
    // Make a snapshot of the props so that we can check if the props were mutated.
    if (process.env.NODE_ENV !== 'production') {
      this._propsSnapshot = clone(props);
    }

    this.proc = new Proc(generator, props);
    this.proc.start();
  }

  _stop() {
    this.proc.stop();

    this.taskWasStopped();
  }

}

Task.propTypes = {
  generator: React.PropTypes.func,
  children: (props, propName, componentName) => {
    if (props[propName]) {
      return new Error('Task components should not have any children. To organize ' +
          'tasks in a hierarchy, use normal elements like <div>, <span>, etc.');
    }
  },
};



// Proc
// ----
export class Proc {
  constructor(generatorFn, ...args) {
    this.generatorFn = generatorFn;
    this.args = args;
  }

  start() {
    // Don't do anything if already started.
    if (this.generator) {
      return;
    }

    this.generator = this.generatorFn(...this.args);

    // Make sure that the function is actually a generator function, or at
    // least something that pretends to be one.
    if (!(this.generator &&
          typeof this.generator.next === 'function' &&
          typeof this.generator.throw === 'function' &&
          typeof this.generator.return === 'function')) {
      throw new Error(`Function supplied to Proc did not return a generator: ${this.generator}`);
    }

    this._continueExecution(undefined, false);
  }

  _continueExecution(returnedValue, isError) {
    // Send the previous call's return value to the generator and get the next
    // value that the generator yields, which should be a call object.
    const generatorResult = isError ?
      this.generator.throw(returnedValue) :
      this.generator.next(returnedValue);

    // Stop execution if the generator has finished.
    if (generatorResult.done) {
      this.generator = null;
      return;
    }

    // Stop and throw an error if the value returned by the generator was not a
    // valid call object.
    if (!Proc.isCall(generatorResult.value)) {
      this.stop();
      throw new Error(`Value yielded by generator was not a valid Proc.call object: ${generatorResult.value}`);
    }

    // Actually call the function and make the generator handle any errors.
    let callResult;

    try {
      callResult = Proc.doCall(generatorResult.value);
    } catch (error) {
      this._continueExecution(error, true);
      return;
    }

    // Wrapping the return value in Promise.resolve will allow us to treat it
    // like a promise even if it is just a normal value, while still allowing
    // promises to work normally.
    const promise = Promise.resolve(callResult);
    promise.then(result => {
      this._continueExecution(result, false);
    }).catch(error => {
      this._continueExecution(error, true);
    });

    // Save the returned promise's cancel method if it has one.
    if (callResult && typeof callResult[Proc.CANCEL_PROMISE] === 'function') {
      promise[Proc.CANCEL_PROMISE] = callResult[Proc.CANCEL_PROMISE];
    }

    this.lastPromise = promise;
  }

  stop() {
    // Don't do anything if already stopped.
    if (!this.generator) {
      return;
    }

    // The will cause all future calls to this.generator.next() to return {
    // value: undefined, done: true }, which will let _continueExecution know
    // that it should stop.
    this.generator.return();
    this.generator = null;

    // If the most recent promise has a cancel method, call it when the proc
    // gets stopped.
    if (this.lastPromise && typeof this.lastPromise[Proc.CANCEL_PROMISE] === 'function') {
      this.lastPromise[Proc.CANCEL_PROMISE]();
      this.lastPromise = null;
    }
  }
}

// Helper functions to create and execute call objects.
Proc.CALL   = 'Proc/call';
Proc.call   = (fn, ...args) => Proc.apply(undefined, fn, args);
Proc.apply  = (context, fn, args) => ({ [Proc.CALL]: { context, fn, args } });
Proc.doCall = call => {
  const { context, fn, args } = call[Proc.CALL];

  return fn.apply(context, args);
};
Proc.isCall = call => {
  if (!(call && call[Proc.CALL])) {
    return false;
  }

  const { context, fn, args } = call[Proc.CALL];

  return typeof fn === 'function' && Array.isArray(args);
};

// If a promise object has a method with this name attached to it, it will be
// called if the promise was being waited on when Proc.stop() got called.
Proc.CANCEL_PROMISE = 'Proc/cancelPromise';



// TaskTester
// ----------
class TaskTester {
  constructor(element) {
    // TODO: Find out why this doesn't work without .prototype
    if (!(element.type.prototype instanceof Task)) {
      throw new Error('Element given to TaskTester was not an instance of Task.');
    }

    this.generator = element.props.generator ?
      element.props.generator(element.props) :
      (new element.type(element.props)).run();
  }

  /**
   * Throws an error if the next call object that the generator yields doesn't
   * match the given function and arguments.
   */
  calls(fn, ...args) {
    return this.applies(undefined, fn, args);
  }

  /**
   * Throws an error if the next call object that the generator yields doesn't
   * match the given context, function, and arguments.
   */
  applies(context, fn, args) {
    const result = this._next();
    const expectedResult = { done: false, value: Proc.apply(context, fn, args) };

    if (!deepEqual(result, expectedResult)) {
      throw new Error('Task did not yield expected value.');
    }

    return this;
  }

  _next() {
    if (this.nextReturnValue) {
      const { value, isError } = this.nextReturnValue;
      this.nextReturnValue = null;

      return isError ?
        this.generator.throw(value) :
        this.generator.next(value);
    } else {
      return this.generator.next();
    }
  }

  /**
   * Causes the given value to be passed to this.generator.next() the next time
   * calls() or applies() is called.
   */
  returns(value) {
    this.nextReturnValue = { value, isError: false };

    return this;
  }

  /**
   * Causes the given value to be passed to this.generator.throw() the next
   * time calls() or applies() is called.
   */
  throws(error) {
    this.nextReturnValue = { value: error, isError: true };

    return this;
  }

  /**
   * Throws an error if the generator yields another value instead of returning
   * or ending.
   */
  ends() {
    const result = this.generator.next();

    if (result.done !== true) {
      throw new Error('Task did not end.');
    }

    return this;
  }
}



// Examples
// --------
import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';
import ReactTestUtils from 'react-addons-test-utils';

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
