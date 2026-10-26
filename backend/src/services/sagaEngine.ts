export type WorkflowNode = {
  id: number | string;
  type: "Start" | "Task" | "End";
  title: string;
  description: string;
  data?: Record<string, unknown>;
};

export type WorkflowEdge = {
  id?: string;
  source: string;
  target: string;
};

export type SagaStepResult = {
  nodeId: string;
  name: string;
  status: "completed" | "failed";
  startedAt: Date;
  completedAt: Date;
  output?: unknown;
  error?: string;
};

export type SagaExecutionResult = {
  status: "completed" | "failed";
  steps: SagaStepResult[];
  startedAt: Date;
  completedAt: Date;
  error?: string;
};

type TaskContext = {
  node: WorkflowNode;
  completedSteps: SagaStepResult[];
};

type TaskHandler = (
  context: TaskContext,
) => Promise<unknown>;

type CompensationHandler = (
  context: TaskContext,
  output: unknown,
) => Promise<void>;

export type SagaEngineOptions = {
  maxRetries?: number;
  retryDelayMs?: number;
  taskHandler?: TaskHandler;
  compensationHandler?: CompensationHandler;
};

const getNodeName = (node: WorkflowNode): string =>
  node.title?.trim() || `${node.type} ${node.id}`;

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function buildTaskOrder(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  const nodeMap = new Map<string, WorkflowNode>();

  for (const node of nodes) {
    const id = String(node.id);

    if (nodeMap.has(id)) {
      throw new Error(`Duplicate node ID: ${id}`);
    }

    if (!["Start", "Task", "End"].includes(node.type)) {
      throw new Error(`Unsupported node type for node ${id}`);
    }

    nodeMap.set(id, node);
  }

  const starts = nodes.filter((node) => node.type === "Start");
  const ends = nodes.filter((node) => node.type === "End");

  if (starts.length !== 1 || ends.length !== 1) {
    throw new Error(
      "A workflow must contain exactly one Start node and one End node.",
    );
  }

  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const id of nodeMap.keys()) {
    outgoing.set(id, []);
    incomingCount.set(id, 0);
  }

  for (const edge of edges) {
    const source = String(edge.source);
    const target = String(edge.target);

    if (!nodeMap.has(source) || !nodeMap.has(target)) {
      throw new Error("A connection refers to a missing node.");
    }

    if (source === target) {
      throw new Error("A node cannot connect to itself.");
    }

    outgoing.get(source)!.push(target);
    incomingCount.set(target, incomingCount.get(target)! + 1);
  }

  const ordered: WorkflowNode[] = [];
  const visited = new Set<string>();
  let current = String(starts[0].id);

  while (true) {
    if (visited.has(current)) {
      throw new Error("Cycles are not supported by this Saga Engine.");
    }

    visited.add(current);
    const node = nodeMap.get(current)!;
    ordered.push(node);

    if (node.type === "End") {
      break;
    }

    const next = outgoing.get(current)!;

    if (next.length !== 1) {
      throw new Error(
        `Node "${getNodeName(node)}" must have exactly one outgoing connection.`,
      );
    }

    const nextId = next[0];

    if (incomingCount.get(nextId) !== 1) {
      throw new Error(
        `Node "${getNodeName(nodeMap.get(nextId)!)}" must have exactly one incoming connection.`,
      );
    }

    current = nextId;
  }

  if (visited.size !== nodes.length) {
    throw new Error(
      "Every workflow node must be connected in the Start-to-End path.",
    );
  }

  if (ordered[0].type !== "Start" ||
      ordered[ordered.length - 1].type !== "End") {
    throw new Error("The workflow path must begin at Start and end at End.");
  }

  return ordered;
}

async function defaultTaskHandler(
  context: TaskContext,
): Promise<unknown> {
  const description = context.node.description.trim();

  if (!description) {
    throw new Error(
      `Task "${getNodeName(context.node)}" has no description.`,
    );
  }

  // This default handler validates the task configuration.
  // Replace it with a real integration when task types are defined.
  return {
    message: "Task configuration validated.",
    task: getNodeName(context.node),
    description,
  };
}

export async function runSaga(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options: SagaEngineOptions = {},
): Promise<SagaExecutionResult> {
  const startedAt = new Date();
  const orderedNodes = buildTaskOrder(nodes, edges);
  const maxRetries = Math.max(
    0,
    Math.min(5, Math.floor(options.maxRetries ?? 2)),
  );
  const retryDelayMs = Math.max(
    0,
    Math.min(10_000, options.retryDelayMs ?? 250),
  );
  const taskHandler = options.taskHandler ?? defaultTaskHandler;
  const compensationHandler = options.compensationHandler;

  const steps: SagaStepResult[] = [];
  const completedTasks: Array<{
    node: WorkflowNode;
    output: unknown;
  }> = [];

  try {
    for (const node of orderedNodes) {
      if (node.type !== "Task") {
        steps.push({
          nodeId: String(node.id),
          name: getNodeName(node),
          status: "completed",
          startedAt: new Date(),
          completedAt: new Date(),
          output: { message: `${node.type} node passed.` },
        });
        continue;
      }

      const stepStartedAt = new Date();
      let output: unknown;
      let lastError: unknown;
      let succeeded = false;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          output = await taskHandler({
            node,
            completedSteps: [...steps],
          });
          succeeded = true;
          break;
        } catch (error) {
          lastError = error;

          if (attempt < maxRetries) {
            const delay = retryDelayMs * 2 ** attempt;
            await wait(delay);
          }
        }
      }

      if (!succeeded) {
        const message =
          lastError instanceof Error
            ? lastError.message
            : "Task failed with an unknown error.";

        steps.push({
          nodeId: String(node.id),
          name: getNodeName(node),
          status: "failed",
          startedAt: stepStartedAt,
          completedAt: new Date(),
          error: message,
        });

        if (compensationHandler) {
          for (const completed of [...completedTasks].reverse()) {
            try {
              await compensationHandler(
                {
                  node: completed.node,
                  completedSteps: [...steps],
                },
                completed.output,
              );
            } catch (compensationError) {
              const compensationMessage =
                compensationError instanceof Error
                  ? compensationError.message
                  : "Compensation failed.";

              steps.push({
                nodeId: String(completed.node.id),
                name: `Compensation: ${getNodeName(completed.node)}`,
                status: "failed",
                startedAt: new Date(),
                completedAt: new Date(),
                error: compensationMessage,
              });
            }
          }
        }

        return {
          status: "failed",
          steps,
          startedAt,
          completedAt: new Date(),
          error: `Task "${getNodeName(node)}" failed: ${message}`,
        };
      }

      const result: SagaStepResult = {
        nodeId: String(node.id),
        name: getNodeName(node),
        status: "completed",
        startedAt: stepStartedAt,
        completedAt: new Date(),
        output,
      };

      steps.push(result);
      completedTasks.push({ node, output });
    }

    return {
      status: "completed",
      steps,
      startedAt,
      completedAt: new Date(),
    };
  } catch (error) {
    return {
      status: "failed",
      steps,
      startedAt,
      completedAt: new Date(),
      error: error instanceof Error ? error.message : "Saga execution failed.",
    };
  }
}
