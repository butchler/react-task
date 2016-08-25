import React from 'react';
import Promise from 'promise';
import { runProc } from './proc';

/**
 * A helper function to create a stateless React component that renders a Task
 * component with the given generator function.
 */
export function task(generatorFunction) {
  const component = props => {
    return <Task proc={generatorFunction} {...props} />;
  };

  // If the function is named, use its name as the component's displayName for
  // debugging purposes.
  const procName = generatorFunction.name || generatorFunction.displayName;
  component.displayName = `task(${procName})`;

  return component;
}

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
export class Task extends React.Component {
  constructor() {
    super();

    // Private variables.
    this.onPropsReceived = null;
    this.proc = null;
    this.boundGetProps = this.getProps.bind(this);
    this.boundOnStep = this.onStep.bind(this);
    this.wasUnmounted = false;
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

      if (this.onPropsReceived !== null) {
        throw new Error('Cannot call getProps more than once at a time.');
      }

      // Check if the props match the filter whenever they change.
      this.onPropsReceived = (nextProps) => {
        if (filterFn(nextProps)) {
          resolve(nextProps);
          this.onPropsReceived = null;
        }
      };
    });
  }

  /**
   * Updates the state with the result of the last call for debugging purposes.
   */
  onStep(step) {
    // Don't update the state if the component has already been unmounted.
    if (!this.wasUnmounted) {
      this.setState({ currentStep: step });
    }
  }

  start() {
    const generator = this.props.proc(this.boundGetProps);
    this.proc = runProc(generator, this.boundOnStep);
    // Ensure that uncaught rejections get logged as errors.
    this.proc.done();
  }

  stop() {
    if (this.proc) {
      this.proc.cancel();
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
      console.warn('Changing the proc property of the Task component will not ' +
        'cause the process to restart. Use the task() helper function instead of ' +
        'using the Task component directly, or set a key prop on the Task ' +
        'component to make it mount a new component when the proc changes.');
    } else {
      if (this.onPropsReceived !== null) {
        this.onPropsReceived(nextProps);
      }
    }
  }

  componentWillUnmount() {
    this.stop();
    this.wasUnmounted = true;
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
