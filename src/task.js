import React from 'react';
import EventEmitter from 'events';

import { runProc } from './proc';

/**
 * <Task generator={...} ... />
 *
 * A Task component starts a Proc (which is basically a background process that
 * runs a generator function) when it gets mounted, and stops the Proc when it
 * gets unmounted.
 *
 * To define a Task, create a new class that extends Task and overrides the
 * *run() generator method.
 *
 * Alternatively, you can just pass a generator function to the "generator"
 * prop, and all other props will be passed as the first argument to the
 * function.
 *
 * NOTE: A Task will only stop its Proc when it gets unmounted or the generator
 * prop is changed. To restart a Task with new props, pass a unique "key" prop,
 * which will force React to unmount the Task when the key changes.
 *
 * Alternatively, you can use the this.getProps() method (which is also passed
 * as the second argument to he generator function) to get the current state of
 * the Task's props in the middle of the Task's execution.
 */
export default class Task extends React.Component {
  constructor() {
    super();

    // Private variables.
    this._events = new EventEmitter();
    this._getProps = this.getProps.bind(this);
  }

  getGeneratorFunction(props) {
    return props.generator || this.run.bind(this);
  }

  // Returns a promise that resolves with the props when they match the given
  // filter, or resolves with the current props immediately if no filter
  // function is provided.
  getProps(filterFn = (() => true)) {
    return new Promise((resolve, reject) => {
      // Check and resolve immediately if the props already match the filter.
      if (filterFn(this.props)) {
        resolve(this.props);
        return;
      }

      const handlePropsChanged = (nextProps) => {
        if (filterFn(nextProps)) {
          resolve(nextProps);
          this._events.removeListener('propsChanged', handlePropsChanged);
        }
      };

      // Check if the props match the filter whenever they change.
      this._events.on('propsChanged', handlePropsChanged);
    });
  }

  propsChanged(nextProps) {
    this._events.emit('propsChanged', nextProps);
  }

  // React lifecycle methods
  // -----------------------

  // Start a Proc (which is basically a background process that runs a
  // generator function) when the Task component gets mounted, and stop the
  // proc when it gets unmounted.
  componentDidMount() {
    this._start(this.props);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.generator !== nextProps.generator) {
      // If the generator has changed, stop the old Proc and start a new one.
      this._stop();
      this._start(nextProps);
    } else {
      this.propsChanged(nextProps);
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

  // Generator method that performs side effects by yielding calls to proc.call/apply.
  run() {
    throw new Error('Subclasses of Task must override the run() method, or a ' +
        'generator={...} prop must be passed to the Task component.');
  }

  // "Private" methods
  // -----------------

  _start(props) {
    const promise = runProc(this.getGeneratorFunction(props), props, this._getProps);
    this._stopProc = promise.cancel;
  }

  _stop() {
    if (this._stopProc) {
      this._stopProc();
    }
  }
}

Task.propTypes = {
  generator: React.PropTypes.func,
  children: (props, propName, componentName) => {
    if (props.children) {
      return new Error('Task components should not have any children. To organize ' +
          'tasks in a hierarchy, use normal elements like <div>, <span>, etc.');
    }
  },
};
