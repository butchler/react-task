import Task from './Task';

export default class TaskRunner {
  constructor() {
    this.taskSet = {};
  }

  getTasks() {
    return this.taskSet;
  }

  setTasks(taskDefinitionArray) {
    const taskDefinitions = mapTaskDefinitionArrayToSet(taskDefinitionArray);

    // Stop old tasks.
    Object.keys(this.taskSet).forEach(key => {
      if (!taskDefinitionSet::has(key)) {
        this.taskSet[key].stop();
        delete this.taskSet[key];
      }
    });

    // Start new tasks.
    Object.keys(taskDefinitions).forEach(key => {
      const task = this.taskSet[key];

      if (task) {
        task.update(taskDefinitions[key]);
      } else {
        this.taskSet[key] = new Task(taskDefinitions[key]);
      }
    });
  }
}

function mapTaskDefinitionArrayToSet(taskDefinitionArray = []) {
  const taskSet = {};

  taskDefinitionArray.forEach(taskDefinition => {
    if (taskDefinition) {
      const taskKey = taskDefinition.key;

      if (taskSet::has(taskKey)) {
        throw new Error('Two tasks in the same TaskRunner cannot share the same key.');
      } else {
        taskSet[taskKey] = taskDefinition;
      }
    }
  });

  return taskSet;
}
