import React from 'react';
import PropTypes from 'prop-types';

export default class TimeoutChildren extends React.Component {
  constructor() {
    super();

    this.state = {
      isDone: false,
    };

    this.onTimeout = () => this.setState({ isDone: true });
  }

  render() {
    if (this.state.isDone) {
      return this.props.children;
    } else {
      return <Timeout onTimeout={this.onTimeout} ms={this.props.ms} />;
    }
  }
}

TimeoutChildren.propTypes = {
  children: PropTypes.node,
  ms: PropTypes.number.isRequired,
};
