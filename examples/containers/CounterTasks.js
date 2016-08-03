import { connect } from 'react-redux';
import CounterTasks from '../components/CounterTasks';

function mapState(state) {
  return { counterIds: state.counters.map(counter => counter.id) };
}

export default connect(mapState, null)(CounterTasks);
