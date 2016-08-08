import React from 'react';

import { runProc } from './proc';

/**
 * <Task proc={...} ... />
 *
 * A Task component starts a Proc (which is basically a background process that
 * runs a generator function) when it gets mounted, and stops the Proc when it
 * gets unmounted (or when the value of the proc prop gets changed).
 *
 * The generator function will get passed a `getProps` function, which returns a
 * promise that resolves with the component's current props. If you pass a
 * function to the getProps function, the props will be passed to that function
 * and the promise returned by getProps will only resolve once that function
 * returns a truthy value.
 *
 * NOTE: A Task will only stop its Proc when it gets unmounted or the proc prop
 * is changed. To restart a Task with new props, pass a unique "key" prop, which
 * will force React to unmount the Task when the key changes.
 *
 * Alternatively, you can use the this.getProps() method (which is also passed
 * as the second argument to he generator function) to get the current state of
 * the Task's props in the middle of the Task's execution.
 */
export default class Task extends React.Component {
  constructor() {
    super();

    // Private variables.
    this._onPropsReceived = null;
    this._proc = null;
    this._getProps = this.getProps.bind(this);
    this._onStep = this.onStep.bind(this);
  }

  /**
   * Returns a promise that resolves with the props when they match the given
   * filter, or resolves with the current props immediately if no filter
   * function is provided.
   */
  getProps(filterFn = (() => true)) {
    return new Promise((resolve, reject) => {
      // Check and resolve immediately if the props already match the filter.
      if (filterFn(this.props)) {
        resolve(this.props);
        return;
      }

      if (this._onPropsReceived !== null) {
        throw new Error('Cannot call getProps more than once at a time.');
      }

      // Check if the props match the filter whenever they change.
      this._onPropsReceived = (nextProps) => {
        if (filterFn(nextProps)) {
          resolve(nextProps);
          this._onPropsReceived = null;
        }
      };
    });
  }

  /**
   * Updates the state with the result of the last call for debugging purposes.
   */
  onStep(step, generator) {
    // Don't update the state if the proc is not running, because that means
    // that component has been unmounted. Also, if the generator function gets
    // changed, don't show steps from the old generator if it's still cleaning
    // up inside of a finally block.
    if (this._proc && generator === this._generator) {
      this.setState({ currentStep: step });
    }
  }

  start() {
    this._generator = this.props.proc(this._getProps);
    this._proc = runProc(this._generator, this._onStep);
  }

  stop() {
    if (this._proc) {
      this._proc.cancel();
      this._proc = null;
    }
  }

  // React lifecycle methods
  // -----------------------
  //
  // Starts a proc (which is basically a background process that runs a
  // generator function) when the Task component gets mounted, and stop the proc
  // when it gets unmounted.
  //

  componentDidMount() {
    this.start(this.props);
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.proc !== nextProps.proc) {
      // If the proc has changed, stop the old Proc and start a new one.
      this.stop();
      this.start();
    } else {
      if (this._onPropsReceived !== null) {
        this._onPropsReceived(nextProps);
      }
    }
  }

  componentWillUnmount() {
    this.stop();
  }

  // Task components never render anything by default.
  shouldComponentUpdate() {
    return false;
  }

  render() {
    return null;
  }
}

Task.propTypes = {
  proc: React.PropTypes.func.isRequired,
  children: (props, propName, componentName) => {
    if (props.children) {
      return new Error('Task components should not have any children. To organize ' +
          'tasks in a hierarchy, use normal elements like <div>, <span>, etc.');
    }
  },
};
