import Task from './Task';

export default class TaskRunner {
  constructor() {
    this.taskSet = {};
  }

  getTasks() {
    return this.taskSet;
  }

  setTasks(taskDefinitionArray = []) {
    const taskDefinitions = {};

    // Convert the task definition array to a map of task key to task definition, filtering out
    // falsey values.
    taskDefinitionArray.forEach(taskDefinition => {
      if (taskDefinition) {
        const taskKey = taskDefinition.key;

        if (taskDefinitions.hasOwnProperty(taskKey)) {
          throw new Error('Two tasks in the same TaskRunner cannot share the same key.');
        } else {
          taskDefinitions[taskKey] = taskDefinition;
        }
      }
    });

    // Stop old tasks.
    Object.keys(this.taskSet).forEach(key => {
      if (!taskDefinitions.hasOwnProperty(key)) {
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

  clearTasks() {
    this.setTasks();
  }
}
