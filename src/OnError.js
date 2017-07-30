import React from 'react';
import PropTypes from 'prop-types';
import { ON_ERROR_KEY } from './constants';
import { callWithOnError } from './utils';

export default class OnError extends React.Component {
  constructor() {
    super();

    this.onError = () => callWithOnError(this.props.onError, this.context[ON_ERROR_KEY]);
  }

  getChildContext() {
    return {
      onError: this.onError,
    };
  }

  // TODO: Use correct method name
  componentDidError(error) {
    this.onError(error);
  }

  render() {
    return React.Children.only(this.props.children);
  }
}

OnError.propTypes = {
  onError: PropTypes.func.isRequired,
  chilren: PropTypes.node,
};

OnError.contextTypes = {
  [ON_ERROR_KEY]: PropTypes.func.isRequired,
};
