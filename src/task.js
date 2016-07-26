import React from 'react';
import deepEqual from 'deep-equal';
import clone from 'clone';

import Proc from './proc';

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
