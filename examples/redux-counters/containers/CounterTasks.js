import { connect } from 'react-redux';
import CounterTasks from 'examples/redux-counters/components/CounterTasks';

function mapState(state) {
  return { counterIds: state.counters.map(counter => counter.id) };
}

export default connect(mapState, null)(CounterTasks);
