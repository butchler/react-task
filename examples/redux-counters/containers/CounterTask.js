import { connect } from 'react-redux';
import CounterTask from 'examples/redux-counters/components/CounterTask';
import { incrementCounter } from 'examples/redux-counters/actions';

function mapDispatch(dispatch, { id }) {
  return { onCount: () => dispatch(incrementCounter(id)) };
}

export default connect(null, mapDispatch)(CounterTask);
