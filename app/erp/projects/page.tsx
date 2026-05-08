import { listProjects, listTasks, type ClientSafeProject, type ClientSafeTask } from "./actions";
import ProjectsClient from "./projects-client";

export default async function ProjectsPage() {
  const [pRes, tRes] = await Promise.all([listProjects(), listTasks()]);
  const projects = pRes.success ? pRes.projects : [];
  const tasks = tRes.success ? tRes.tasks : [];
  return <ProjectsClient initialProjects={projects} initialTasks={tasks} />;
}
