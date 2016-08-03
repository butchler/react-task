import { connect } from 'react-redux';
import CounterTask from '../components/CounterTask';
import { incrementCounter } from '../actions';

function mapDispatch(dispatch, { id }) {
  return { onCount: () => dispatch(incrementCounter(id)) };
}

export default connect(null, mapDispatch)(CounterTask);
