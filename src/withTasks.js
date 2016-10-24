import React from 'react';
import TaskRunner from './TaskRunner';

export default function withTasks(mapPropsToTasks) {
  return WrappedComponent => {
    class WithTasks extends React.Component {
      constructor() {
        super();

        this.taskRunner = new TaskRunner();
      }

      componentDidMount() {
        this.updateTasks();
      }

      componentDidUpdate() {
        this.updateTasks();
      }

      componentWillUnmount() {
        this.taskRunner.clearTasks();
      }

      updateTasks() {
        this.taskRunner.setTasks(mapPropsToTasks(this.props));
      }

      render() {
        const taskSet = { ['withTasks/taskSet']: this.taskRunner.getTasks() };
        return <WrappedComponent {...taskSet} {...this.props} />;
      }
    }

    WithTasks.displayName = `WithTasks(${getComponentName(WrappedComponent)})`;
    WithTasks.WrappedComponent = WrappedComponent;

    return WithTasks;
  };
}

function getComponentName(component) {
  return component.displayName || component.name || 'Component';
}
