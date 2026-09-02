import { TaskBoard } from "@/src/features/tasks/components/task-board";

export default function HojePage() {
  return <TaskBoard escopo="meu-dia" rota="/hoje" titulo="Meu dia" />;
}
