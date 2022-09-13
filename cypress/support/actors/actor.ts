import { SetupTask } from "../tasks/setup-task";

class Actor {
    setupTask: SetupTask = new SetupTask();
}

const actor = new Actor();
export { actor };
