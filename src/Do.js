import React from 'react';
import PropTypes from 'prop-types';
import { ON_ERROR_KEY } from './constants';
import { callWithOnError } from './utils';

export default class Do extends React.Component {
  componentDidMount() {
    callWithOnError(this.props.onMount, this.context[ON_ERROR_KEY]);
  }

  componentWillUnmount() {
    callWithOnError(this.props.onUnmount, this.context[ON_ERROR_KEY]);
  }

  render() {
    return null;
  }
}

Do.propTypes = {
  onMount: PropTypes.func,
  onUnmount: PropTypes.func,
};

Do.contextTypes = {
  [ON_ERROR_KEY]: PropTypes.func.isRequired,
};
