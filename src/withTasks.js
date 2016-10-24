import React from 'react';
import TaskRunner from './TaskRunner';

function withTasks(mapPropsToTasks) {
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
