
import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'

import '@xyflow/react/dist/style.css'

import {
  LayoutDashboard,
  Workflow,
  Activity,
  ShieldCheck,
  Search,
  Bell,
  Plus,
  Save,
  Play,
  GitBranch,
  Settings,
  Flame,
  Trash2,
  Undo2,
  Redo2,
  CheckCircle,
  AlertTriangle,
  Palette,
  X,
} from 'lucide-react'

import './App.css'

type NodeType = 'Start' | 'Task' | 'End'

type WorkflowNode = {
  id: number
  type: NodeType
  title: string
  description: string
  isNew?: boolean
}

type FlowNodeData = {
  label: string
}

type Execution = {
  _id: string
  status: string
  startedAt?: string
}

type WorkflowSnapshot = {
  name: string
  nodes: WorkflowNode[]
  edges: Edge[]
}

const initialWorkflowNodes: WorkflowNode[] = [
  {
    id: 1,
    type: 'Start',
    title: 'Start',
    description: 'Workflow execution begins here.',
  },
  {
    id: 2,
    type: 'Task',
    title: 'Process Request',
    description: 'Process the incoming request.',
  },
  {
    id: 3,
    type: 'End',
    title: 'End',
    description: 'Workflow execution completes here.',
  },
]

const createFlowNodes = (
  nodes: WorkflowNode[],
): Node<FlowNodeData>[] => {
  return nodes.map((node, index) => {
    const borderColor =
      node.type === 'Start'
        ? '#22c55e'
        : node.type === 'End'
          ? '#ef4444'
          : node.isNew
            ? '#3b82f6'
            : '#8b5cf6'

    const backgroundColor =
      node.type === 'Start'
        ? '#dcfce7'
        : node.type === 'End'
          ? '#fee2e2'
          : node.isNew
            ? '#dbeafe'
            : '#ede9fe'

    return {
      id: String(node.id),
      type: 'default',
      position: {
        x: 100 + index * 230,
        y: 150,
      },
      data: {
        label: `${node.type}: ${node.title || '(Unnamed)'}`,
      },
      style: {
        width: 180,
        padding: 16,
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        background: backgroundColor,
        color: '#1f2937',
        fontWeight: 600,
        boxShadow: node.isNew
          ? '0 0 0 3px rgba(59, 130, 246, 0.12)'
          : '0 2px 8px rgba(15, 23, 42, 0.05)',
      },
    }
  })
}

const createFlowEdges = (nodes: WorkflowNode[]): Edge[] => {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `e${node.id}-${nodes[index + 1].id}`,
    source: String(node.id),
    target: String(nodes[index + 1].id),
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#9ca3af',
    },
    animated: true,
    style: {
      stroke: '#9ca3af',
      strokeWidth: 2,
    },
  }))
}

const validateWorkflow = (
  workflowName: string,
  nodes: WorkflowNode[],
  edges: Edge[],
): string[] => {
  const errors: string[] = []

  if (!workflowName.trim()) {
    errors.push('Please enter a workflow name.')
  }

  const startNodes = nodes.filter((node) => node.type === 'Start')
  const endNodes = nodes.filter((node) => node.type === 'End')

  if (startNodes.length === 0) {
    errors.push('Workflow must contain a Start node.')
  } else if (startNodes.length > 1) {
    errors.push('Workflow can contain only one Start node.')
  }

  if (endNodes.length === 0) {
    errors.push('Workflow must contain an End node.')
  } else if (endNodes.length > 1) {
    errors.push('Workflow can contain only one End node.')
  }

  if (nodes.length < 2) {
    errors.push('Workflow must contain at least a Start and End node.')
  }

  const ids = new Set<number>()

  nodes.forEach((node) => {
    if (ids.has(node.id)) {
      errors.push(`Duplicate node ID found: ${node.id}.`)
    }

    ids.add(node.id)

    if (!node.title.trim()) {
      errors.push(`${node.type} node #${node.id} needs a name.`)
    }

    if (node.type === 'Task' && !node.description.trim()) {
      errors.push(`Task "${node.title || node.id}" needs a description.`)
    }
  })

  const nodeIds = new Set(nodes.map((node) => String(node.id)))

  edges.forEach((edge) => {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Connection has an invalid source: ${edge.source}.`)
    }

    if (!nodeIds.has(edge.target)) {
      errors.push(`Connection has an invalid target: ${edge.target}.`)
    }

    if (edge.source === edge.target) {
      errors.push('A node cannot connect to itself.')
    }
  })

  if (nodes.length >= 2 && edges.length === 0) {
    errors.push('Connect the workflow nodes before running.')
  }

  return [...new Set(errors)]
}

function App() {
  const [activePage, setActivePage] = useState('Workflow Editor')
  const [selectedNode, setSelectedNode] = useState(2)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [workflowName, setWorkflowName] = useState('My First Workflow')
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [executions, setExecutions] = useState<Execution[]>([])
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showValidation, setShowValidation] = useState(false)
  const [showColorLegend, setShowColorLegend] = useState(true)

  const [workflowNodes, setWorkflowNodes] =
    useState<WorkflowNode[]>(initialWorkflowNodes)

  const [deletedTask, setDeletedTask] =
    useState<WorkflowNode | null>(null)

  const [flowNodes, setFlowNodes] =
    useState<Node<FlowNodeData>[]>(createFlowNodes(initialWorkflowNodes))

  const [flowEdges, setFlowEdges] =
    useState<Edge[]>(createFlowEdges(initialWorkflowNodes))

  const [undoStack, setUndoStack] = useState<WorkflowSnapshot[]>([])
  const [redoStack, setRedoStack] = useState<WorkflowSnapshot[]>([])

  const currentNode = workflowNodes.find(
    (node) => node.id === selectedNode,
  )

  const createSnapshot = (): WorkflowSnapshot => ({
    name: workflowName,
    nodes: workflowNodes.map((node) => ({ ...node })),
    edges: flowEdges.map((edge) => ({ ...edge })),
  })

  const syncWorkflow = (
    nodes: WorkflowNode[],
    edges: Edge[] = createFlowEdges(nodes),
    recordHistory = true,
  ) => {
    if (recordHistory) {
      setUndoStack((stack) => [...stack, createSnapshot()].slice(-30))
      setRedoStack([])
    }

    setWorkflowNodes(nodes)
    setFlowNodes(createFlowNodes(nodes))
    setFlowEdges(edges)
    setSelectedEdge(null)
    setValidationErrors([])
    setShowValidation(false)
  }

  const undoChange = () => {
    if (undoStack.length === 0) {
      setNotice('Nothing to undo.')
      return
    }

    const previous = undoStack[undoStack.length - 1]
    const current = createSnapshot()

    setRedoStack((stack) => [...stack, current])
    setUndoStack((stack) => stack.slice(0, -1))

    setWorkflowName(previous.name)
    setWorkflowNodes(previous.nodes)
    setFlowNodes(createFlowNodes(previous.nodes))
    setFlowEdges(previous.edges)
    setSelectedEdge(null)
    setValidationErrors([])
    setShowValidation(false)
    setNotice('Last workflow change undone.')
  }

  const redoChange = () => {
    if (redoStack.length === 0) {
      setNotice('Nothing to redo.')
      return
    }

    const next = redoStack[redoStack.length - 1]
    const current = createSnapshot()

    setUndoStack((stack) => [...stack, current])
    setRedoStack((stack) => stack.slice(0, -1))

    setWorkflowName(next.name)
    setWorkflowNodes(next.nodes)
    setFlowNodes(createFlowNodes(next.nodes))
    setFlowEdges(next.edges)
    setSelectedEdge(null)
    setValidationErrors([])
    setShowValidation(false)
    setNotice('Workflow change restored.')
  }

  const addTask = () => {
    const endIndex = workflowNodes.findIndex(
      (node) => node.type === 'End',
    )

    const newId =
      Math.max(...workflowNodes.map((node) => node.id), 0) + 1

    const newTask: WorkflowNode = {
      id: newId,
      type: 'Task',
      title: `New Task ${newId}`,
      description: 'Configure this task.',
      isNew: true,
    }

    const updatedNodes = [...workflowNodes]
    updatedNodes.splice(
      endIndex === -1 ? updatedNodes.length : endIndex,
      0,
      newTask,
    )

    syncWorkflow(updatedNodes)
    setSelectedNode(newTask.id)
    setNotice('New task added in blue. Save the workflow to confirm it.')
  }

  const deleteTask = () => {
    const nodeToDelete = workflowNodes.find(
      (node) => node.id === selectedNode,
    )

    if (!nodeToDelete || nodeToDelete.type !== 'Task') {
      setNotice('Only Task nodes can be deleted.')
      return
    }

    if (!window.confirm(`Delete "${nodeToDelete.title}"?`)) return

    const updatedNodes = workflowNodes.filter(
      (node) => node.id !== selectedNode,
    )

    const remainingIds = new Set(updatedNodes.map((node) => String(node.id)))
    const updatedEdges = flowEdges.filter(
      (edge) =>
        remainingIds.has(edge.source) && remainingIds.has(edge.target),
    )

    setDeletedTask(nodeToDelete)
    syncWorkflow(updatedNodes, updatedEdges)

    const nextNode =
      updatedNodes.find((node) => node.type === 'Task') ?? updatedNodes[0]

    if (nextNode) setSelectedNode(nextNode.id)

    setNotice(`${nodeToDelete.title} deleted. You can undo this action.`)
  }

  const undoDeleteTask = () => {
    if (!deletedTask) return

    if (workflowNodes.some((node) => node.id === deletedTask.id)) {
      setNotice('Cannot restore: this task ID is already in use.')
      return
    }

    const updatedNodes = [...workflowNodes]
    const endIndex = updatedNodes.findIndex((node) => node.type === 'End')

    updatedNodes.splice(
      endIndex === -1 ? updatedNodes.length : endIndex,
      0,
      deletedTask,
    )

    syncWorkflow(updatedNodes)
    setSelectedNode(deletedTask.id)
    setDeletedTask(null)
    setNotice('Task restored. Save to store your changes.')
  }

  const deleteSelectedConnection = () => {
    if (!selectedEdge) {
      setNotice('Select a connection on the canvas first.')
      return
    }

    const edgeToDelete = flowEdges.find(
      (edge) => edge.id === selectedEdge,
    )

    if (!edgeToDelete) {
      setSelectedEdge(null)
      setNotice('Selected connection was not found.')
      return
    }

    const snapshot: WorkflowSnapshot = {
      name: workflowName,
      nodes: workflowNodes.map((node) => ({ ...node })),
      edges: flowEdges.map((edge) => ({ ...edge })),
    }

    setUndoStack((stack) => [...stack, snapshot].slice(-30))
    setRedoStack([])
    setFlowEdges((edges) =>
      edges.filter((edge) => edge.id !== selectedEdge),
    )
    setSelectedEdge(null)
    setNotice('Connection deleted. You can use Undo to restore it.')
  }

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<FlowNodeData>>[]) => {
      // Prevent React Flow's keyboard deletion from removing nodes.
      const safeChanges = changes.filter(
        (change) => change.type !== 'remove',
      )

      if (safeChanges.length > 0) {
        setFlowNodes((nodes) => applyNodeChanges(safeChanges, nodes))
      }
    },
    [],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      // Ignore React Flow's automatic edge removal. Use the
      // Delete Connection button so edge deletion is undoable.
      const safeChanges = changes.filter(
        (change) => change.type !== 'remove',
      )

      if (safeChanges.length > 0) {
        setFlowEdges((edges) => applyEdgeChanges(safeChanges, edges))
      }
    },
    [],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const snapshot: WorkflowSnapshot = {
        name: workflowName,
        nodes: workflowNodes.map((node) => ({ ...node })),
        edges: flowEdges.map((edge) => ({ ...edge })),
      }

      setUndoStack((stack) => [...stack, snapshot].slice(-30))
      setRedoStack([])

      setFlowEdges((edges) =>
        addEdge(
          {
            ...connection,
            id: `e${connection.source}-${connection.target}-${Date.now()}`,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#9ca3af',
            },
            animated: true,
            style: { stroke: '#9ca3af', strokeWidth: 2 },
          },
          edges,
        ),
      )

      setSelectedEdge(null)
      setNotice('Connection added. You can undo this action.')
    },
    [workflowName, workflowNodes, flowEdges],
  )

  const saveWorkflow = async () => {
    const errors = validateWorkflow(workflowName, workflowNodes, flowEdges)

    setValidationErrors(errors)
    setShowValidation(true)

    if (errors.length > 0) {
      setNotice('Workflow has validation errors. Fix them before saving.')
      return
    }

    const savedNodes = workflowNodes.map((node) => ({
      ...node,
      isNew: false,
    }))

    const draft = {
      name: workflowName.trim(),
      nodes: savedNodes,
      edges: flowEdges,
      updatedAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem('flowpilot-workflow', JSON.stringify(draft))

      setWorkflowNodes(savedNodes)
      setFlowNodes(createFlowNodes(savedNodes))

      const response = await fetch('http://localhost:5000/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })

      if (response.ok) {
        const result = await response.json()
        if (result._id) setWorkflowId(result._id)
        setNotice('Workflow saved successfully!')
      } else {
        setNotice('Draft saved in this browser. Backend save was unsuccessful.')
      }
    } catch {
      setNotice('Workflow draft saved in this browser. Backend is not connected.')
    }
  }

  const runWorkflow = async () => {
    if (isRunning) return

    const errors = validateWorkflow(workflowName, workflowNodes, flowEdges)

    setValidationErrors(errors)
    setShowValidation(true)

    if (errors.length > 0) {
      setNotice('Workflow cannot run. Fix the validation errors first.')
      return
    }

    const confirmed = window.confirm(
      `Run workflow "${workflowName.trim()}" with ${workflowNodes.length} nodes?`,
    )

    if (!confirmed) return

    setIsRunning(true)
    setNotice('Starting workflow...')

    try {
      const response = await fetch('http://localhost:5000/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          name: workflowName.trim(),
          nodes: workflowNodes,
          edges: flowEdges,
        }),
      })

      if (!response.ok) {
        setNotice('Backend run failed. Check that the backend is running.')
        return
      }

      setNotice('Workflow execution started!')
      await loadExecutions()
    } catch {
      setNotice('Run unavailable. Please start the backend first.')
    } finally {
      setIsRunning(false)
    }
  }

  const loadExecutions = async () => {
    setIsLoadingExecutions(true)

    try {
      const response = await fetch('http://localhost:5000/api/executions')

      if (!response.ok) {
        setNotice('Could not load execution history.')
        return
      }

      const result = await response.json()
      setExecutions(
        Array.isArray(result) ? result : result.executions ?? [],
      )
    } catch {
      setNotice('Execution history is unavailable. Check the backend.')
    } finally {
      setIsLoadingExecutions(false)
    }
  }

  useEffect(() => {
    const savedDraft = localStorage.getItem('flowpilot-workflow')

    if (!savedDraft) return

    try {
      const draft = JSON.parse(savedDraft)

      if (Array.isArray(draft.nodes) && draft.nodes.length > 0) {
        setWorkflowNodes(draft.nodes)
        setFlowNodes(createFlowNodes(draft.nodes))
        setFlowEdges(
          Array.isArray(draft.edges)
            ? draft.edges
            : createFlowEdges(draft.nodes),
        )
      }

      if (typeof draft.name === 'string') {
        setWorkflowName(draft.name)
      }

      if (typeof draft._id === 'string') {
        setWorkflowId(draft._id)
      }
    } catch {
      localStorage.removeItem('flowpilot-workflow')
    }
  }, [])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2 className="brand">FlowPilot</h2>
        <p className="sidebar-subtitle">WORKFLOW PLATFORM</p>

        {[
          { name: 'Dashboard', icon: LayoutDashboard },
          { name: 'Workflow Editor', icon: Workflow },
          { name: 'Executions', icon: Activity },
          { name: 'Safety Center', icon: ShieldCheck },
        ].map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={`nav-item ${activePage === name ? 'active' : ''}`}
            onClick={() => {
              setActivePage(name)
              if (name === 'Executions') loadExecutions()
            }}
          >
            <Icon size={18} />
            {name}
          </button>
        ))}

        <div className="sidebar-bottom">
          <ShieldCheck size={18} />
          <span>Safety first</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">WORKSPACE / FLOWPILOT</p>
            <h1>{activePage}</h1>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
              />
            </div>
            <button className="icon-button" title="Notifications">
              <Bell size={18} />
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice" role="status">
            {notice}
            <button onClick={() => setNotice('')} aria-label="Dismiss notice">
              <X size={16} />
            </button>
          </div>
        )}

        {activePage === 'Workflow Editor' && (
          <>
            <section className="welcome-row">
              <div>
                <p className="eyebrow">WORKFLOW DESIGNER</p>
                <h2>Build something amazing.</h2>
                <p className="muted">
                  Design, connect, validate, and run your workflow.
                </p>
              </div>

              <div className="toolbar">
                <button className="button button-secondary" onClick={addTask}>
                  <Plus size={17} /> Add Task
                </button>
                <button
                  className="button button-secondary"
                  onClick={undoChange}
                  disabled={undoStack.length === 0}
                >
                  <Undo2 size={17} /> Undo
                </button>
                <button
                  className="button button-secondary"
                  onClick={redoChange}
                  disabled={redoStack.length === 0}
                >
                  <Redo2 size={17} /> Redo
                </button>
                <button
                  className="button button-secondary"
                  onClick={saveWorkflow}
                >
                  <Save size={17} /> Save
                </button>
                <button
                  className="button button-primary"
                  onClick={runWorkflow}
                  disabled={isRunning}
                >
                  <Play size={17} />
                  {isRunning ? 'Running...' : 'Run Workflow'}
                </button>
              </div>
            </section>

            <section className="editor-grid">
              <div className="canvas-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Workflow Canvas</h3>
                    <p className="muted">
                      Select a node or connection to edit it.
                    </p>
                  </div>
                  <GitBranch size={20} />
                </div>

                <input
                  className="workflow-name-input"
                  value={workflowName}
                  onChange={(event) => setWorkflowName(event.target.value)}
                  placeholder="Workflow name"
                  aria-label="Workflow name"
                />

                <div className="flow-canvas">
                  <ReactFlow
                    nodes={flowNodes.map((node) => ({
                      ...node,
                      selected: node.id === String(selectedNode),
                    }))}
                    edges={flowEdges.map((edge) => ({
                      ...edge,
                      selected: edge.id === selectedEdge,
                      style: {
                        ...edge.style,
                        stroke:
                          edge.id === selectedEdge ? '#f59e0b' : '#9ca3af',
                        strokeWidth: edge.id === selectedEdge ? 4 : 2,
                      },
                      markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color:
                          edge.id === selectedEdge ? '#f59e0b' : '#9ca3af',
                      },
                    }))}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={(_, node) => {
                      setSelectedNode(Number(node.id))
                      setSelectedEdge(null)
                    }}
                    onEdgeClick={(_, edge) => {
                      setSelectedEdge(edge.id)
                    }}
                    onPaneClick={() => {
                      setSelectedEdge(null)
                    }}
                    deleteKeyCode={null}
                    fitView
                  >
                    <Background />
                    <Controls />
                    <MiniMap />
                  </ReactFlow>
                </div>

                <div className="canvas-footer">
                  <span>{workflowNodes.length} nodes</span>
                  <span>{flowEdges.length} connections</span>
                  <span>
                    {selectedEdge ? 'Connection selected' : 'Draft mode'}
                  </span>
                </div>

                <div className="connection-actions">
                  <button
                    className="button button-secondary"
                    onClick={deleteSelectedConnection}
                    disabled={!selectedEdge}
                  >
                    <Trash2 size={16} /> Delete Connection
                  </button>
                  <span className="muted">
                    {selectedEdge
                      ? 'Selected connection is orange.'
                      : 'Click a connection to select it.'}
                  </span>
                </div>
              </div>

              <aside className="properties-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">CONFIGURATION</p>
                    <h3>Node Properties</h3>
                  </div>
                  <Settings size={19} />
                </div>

                {currentNode ? (
                  <>
                    <label className="field-label">Node type</label>
                    <div className="node-type-display">{currentNode.type}</div>

                    <label className="field-label" htmlFor="node-title">
                      Node name
                    </label>
                    <input
                      id="node-title"
                      className="form-input"
                      value={currentNode.title}
                      onChange={(event) => {
                        const updatedNodes = workflowNodes.map((node) =>
                          node.id === selectedNode
                            ? { ...node, title: event.target.value }
                            : node,
                        )
                        syncWorkflow(updatedNodes, flowEdges, false)
                      }}
                    />

                    <label className="field-label" htmlFor="node-description">
                      Description
                    </label>
                    <textarea
                      id="node-description"
                      className="form-input"
                      rows={4}
                      value={currentNode.description}
                      onChange={(event) => {
                        const updatedNodes = workflowNodes.map((node) =>
                          node.id === selectedNode
                            ? { ...node, description: event.target.value }
                            : node,
                        )
                        syncWorkflow(updatedNodes, flowEdges, false)
                      }}
                    />

                    {currentNode.type === 'Task' && (
                      <button
                        className="button button-secondary"
                        style={{
                          width: '100%',
                          marginTop: 16,
                          color: '#dc2626',
                          borderColor: '#fecaca',
                        }}
                        onClick={deleteTask}
                      >
                        <Trash2 size={17} /> Delete Task
                      </button>
                    )}

                    {deletedTask && (
                      <button
                        className="button button-secondary"
                        style={{ width: '100%', marginTop: 10 }}
                        onClick={undoDeleteTask}
                      >
                        <Undo2 size={17} /> Undo Delete: {deletedTask.title}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    Select a node to view its properties.
                  </p>
                )}

                {showValidation && (
                  <div className="validation-panel" role="status">
                    <h4>
                      {validationErrors.length === 0 ? (
                        <>
                          <CheckCircle size={17} /> Workflow valid
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={17} /> Validation issues
                        </>
                      )}
                    </h4>

                    {validationErrors.length > 0 && (
                      <ul>
                        {validationErrors.map((error, index) => (
                          <li key={`${error}-${index}`}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {showColorLegend && (
                  <div className="color-legend">
                    <div className="legend-heading">
                      <div>
                        <Palette size={18} />
                        <strong>Color Legend</strong>
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => setShowColorLegend(false)}
                        aria-label="Hide color legend"
                        title="Hide legend"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {[
                      {
                        color: '#22c55e',
                        background: '#dcfce7',
                        title: 'Green',
                        description: 'Start node',
                      },
                      {
                        color: '#8b5cf6',
                        background: '#ede9fe',
                        title: 'Purple',
                        description: 'Existing task',
                      },
                      {
                        color: '#3b82f6',
                        background: '#dbeafe',
                        title: 'Blue',
                        description: 'New unsaved task',
                      },
                      {
                        color: '#ef4444',
                        background: '#fee2e2',
                        title: 'Red',
                        description: 'End node',
                      },
                      {
                        color: '#f59e0b',
                        background: '#fff7ed',
                        title: 'Orange',
                        description: 'Selected connection',
                      },
                      {
                        color: '#9ca3af',
                        background: '#f3f4f6',
                        title: 'Grey',
                        description: 'Normal connection',
                      },
                    ].map((item) => (
                      <div className="legend-item" key={item.title}>
                        <span
                          className="legend-swatch"
                          style={{
                            background: item.background,
                            borderColor: item.color,
                          }}
                        />
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!showColorLegend && (
                  <button
                    className="button button-secondary"
                    onClick={() => setShowColorLegend(true)}
                  >
                    <Palette size={16} /> Show Color Legend
                  </button>
                )}

                <div className="safety-card">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>User Safety</strong>
                    <p>Review workflow actions before running them.</p>
                  </div>
                </div>

                <div className="streak-card">
                  <Flame size={21} />
                  <div>
                    <strong>Work Streak</strong>
                    <p>Keep building consistently!</p>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}

        {activePage === 'Dashboard' && (
          <section className="simple-panel">
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h2>Welcome to FlowPilot</h2>
            <p>Build workflows, manage tasks, and review executions.</p>

            <div className="dashboard-stats">
              <div className="stat-card">
                <Workflow size={21} />
                <strong>{workflowNodes.length}</strong>
                <span>Workflow Nodes</span>
              </div>

              <div className="stat-card">
                <GitBranch size={21} />
                <strong>{flowEdges.length}</strong>
                <span>Connections</span>
              </div>

              <div className="stat-card">
                <Activity size={21} />
                <strong>{executions.length}</strong>
                <span>Executions Loaded</span>
              </div>
            </div>

            <button
              className="button button-primary"
              onClick={() => setActivePage('Workflow Editor')}
            >
              <Workflow size={17} /> Open Workflow Editor
            </button>
          </section>
        )}

        {activePage === 'Executions' && (
          <section className="simple-panel">
            <div className="panel-heading">
              <div>
                <h2>Execution History</h2>
                <p className="muted">Review previously loaded executions.</p>
              </div>

              <button
                className="button button-secondary"
                onClick={loadExecutions}
                disabled={isLoadingExecutions}
              >
                <Activity size={16} />
                {isLoadingExecutions ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {executions.length === 0 ? (
              <p className="muted">
                No executions loaded. Start the backend and refresh to load history.
              </p>
            ) : (
              executions
                .filter((execution) =>
                  `${execution._id} ${execution.status}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((execution, index) => (
                  <div className="execution-row" key={execution._id || index}>
                    <div>
                      <strong>Execution {execution._id || index + 1}</strong>
                      {execution.startedAt && (
                        <p className="muted">
                          {new Date(execution.startedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <span className="execution-status">
                      {execution.status}
                    </span>
                  </div>
                ))
            )}
          </section>
        )}

        {activePage === 'Safety Center' && (
          <section className="simple-panel">
            <div className="safety-heading">
              <ShieldCheck size={30} />
              <div>
                <p className="eyebrow">WORKFLOW SAFETY</p>
                <h2>Safety Center</h2>
              </div>
            </div>

            <p>
              Review your workflow carefully before starting an execution.
            </p>

            <ul className="safety-list">
              <li>Verify each task name and description.</li>
              <li>Check connections between workflow nodes.</li>
              <li>Fix validation errors before running.</li>
              <li>Save your draft before executing.</li>
              <li>Review execution history after a run.</li>
            </ul>

            <button
              className="button button-primary"
              onClick={() => setActivePage('Workflow Editor')}
            >
              <Workflow size={17} /> Return to Workflow Editor
            </button>
          </section>
        )}

        <footer className="app-footer">
          <span>FlowPilot · Workflow Workspace</span>
          <span>Built for safer workflows</span>
        </footer>
      </main>
    </div>
  )
}

export default App
