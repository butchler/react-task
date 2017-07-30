export const callWithOnError = (fn, onError) => {
  if (fn) {
    if (onError) {
      try {
        return fn();
      } catch (error) {
        return onError(error);
      }
    } else {
      return fn();
    }
  } else {
    return undefined;
  }
};

export const callComponentRender = (Component, props, context) => {
  // TODO: Use proper name.
  if (Component.prototype.isReactClass) {
    // Call render() method of component class.
    const componentInstance = new Component(props, context);
    componentInstance.props = props;
    componentInstance.context = context;
    return componentInstance.render();
  } else {
    // Get result of stateless functional component.
    return Component(props, context);
  }
};
