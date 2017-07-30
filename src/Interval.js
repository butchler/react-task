import React from 'react';
import PropTypes from 'prop-types';
import { ON_ERROR_KEY } from './constants';
import { callWithOnError } from './utils';

export default class Interval extends React.Component {
  constructor() {
    super();

    this.onInterval = () => callWithOnError(this.props.onInterval, this.context[ON_ERROR_KEY]);
  }

  componentDidMount() {
    this.intervalId = setInterval(this.onInterval, this.props.ms);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.ms !== this.props.ms) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(this.onInterval, nextProps.ms);
    }
  }

  componentWillUnmount() {
    clearInterval(this.intervalId);
  }

  render() {
    return null;
  }
}

Interval.propTypes = {
  onInterval: PropTypes.func.isRequired,
  ms: PropTypes.number.isRequired,
};

Interval.contextTypes = {
  [ON_ERROR_KEY]: PropTypes.func.isRequired,
};
