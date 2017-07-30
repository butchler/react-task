import React from 'react';
import PropTypes from 'prop-types';
import { ON_ERROR_KEY } from './constants';
import { callWithOnError } from './utils';

export default class Timeout extends React.Component {
  constructor() {
    super();

    this.onTimeout = () => callWithOnError(this.props.onTimeout, this.context[ON_ERROR_KEY]);
  }

  componentDidMount() {
    this.timeoutId = setTimeout(this.onTimeout, this.props.ms);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.ms !== this.props.ms) {
      clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(this.onTimeout, nextProps.ms);
    }
  }

  componentWillUnmount() {
    clearTimeout(this.timeoutId);
  }

  render() {
    return null;
  }
}

Timeout.propTypes = {
  onTimeout: PropTypes.func.isRequired,
  ms: PropTypes.number.isRequired,
};

Timeout.contextTypes = {
  [ON_ERROR_KEY]: PropTypes.func.isRequired,
};
