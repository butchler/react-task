import React from 'react';
import { callComponentRender } from './utils';

export default function withTask(TaskComponent) {
  return (ViewComponent) => {
    class WithTask extends React.Component {
      render() {
        const renderResult = callComponentRender(ViewComponent, this.props, this.context);

        if (!renderResult) {
          return <TaskComponent {...this.props} />;
        } else if (React.isReactElement(renderResult)) {
          // Append task component to end of children.
          // TODO: Use correct method/prop names.
          const children = React.Children.toArray(renderResult.props.children);
          const childrenWithTask = [...children, <TaskComponent {...this.props} />];
          return React.cloneElement(renderResult, null, childrenWithTask);
        } else {
          // TODO: Handle rendering arrays when React supports it.
          throw new Error('Could not mount task component: view component returned invalid result.');
        }
      }
    }

    const taskName = TaskComponent.displayName || TaskComponent.name || 'Component';
    const viewName = ViewComponent.displayName || ViewComponent.name || 'Component';
    WithTask.displayName = `WithTask(${taskName})(${viewName})`;

    // TODO: Maybe hoist non-React statics?

    return WithTask;
  };
}
