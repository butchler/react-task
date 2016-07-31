import React from 'react';
import EventEmitter from 'events';

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
 *
 * Alternatively, you can use the this.getProps() method (which is also passed
 * as the second argument to he generator function) to get the current state of
 * the Task's props in the middle of the Task's execution.
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

    this._events = new EventEmitter();

    // Returns a promise that resolves when the props match the given filter.
    this.getProps = filterFn => {
      return new Promise((resolve, reject) => {
        const handlePropsChanged = (nextProps) => {
          if (filterFn === undefined || filterFn(nextProps)) {
            resolve(nextProps);
            this._events.removeListener('propsChanged', handlePropsChanged);
          }
        };

        // Check and resolve immediately if the props already match the filter.
        handlePropsChanged(this.props);

        // Check if the props match the filter whenever they change.
        this._events.on('propsChanged', handlePropsChanged);
      });
    };

    this._start(generatorFn, this.props);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.generator !== nextProps.generator) {
      // If the generator has changed, stop the old Proc and start a new one.
      this._stop();
      this._start(nextProps.generator, nextProps);
    } else {
      this._events.emit('propsChanged', nextProps);
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
    this.proc = new Proc(generator, props, this.getProps);
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
