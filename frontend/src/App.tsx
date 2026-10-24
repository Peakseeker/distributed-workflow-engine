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
      position: { x: 100 + index * 230, y: 150 },
      data: { label: `${node.type}: ${node.title || '(Unnamed)'}` },
      style: {
        width: 180,
        padding: 16,
        borderRadius: 12,
        border: `2px solid ${borderColor}`,
        background: backgroundColor,
        color: '#1f2937',
        fontWeight: 600,
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

  if (startNodes.length !== 1) {
    errors.push('Workflow must contain exactly one Start node.')
  }

  if (endNodes.length !== 1) {
    errors.push('Workflow must contain exactly one End node.')
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
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push('A connection refers to a missing node.')
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
    setNotice('New task added. Save the workflow to confirm it.')
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
  const saveWorkflow = async (): Promise<string | null> => {
    const errors = validateWorkflow(
      workflowName,
      workflowNodes,
      flowEdges,
    )

    setValidationErrors(errors)
    setShowValidation(true)

    if (errors.length > 0) {
      setNotice('Workflow has validation errors. Fix them before saving.')
      return null
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

    localStorage.setItem('flowpilot-workflow', JSON.stringify(draft))
    setWorkflowNodes(savedNodes)
    setFlowNodes(createFlowNodes(savedNodes))

    try {
      const response = await fetch(
        workflowId
          ? `http://localhost:5000/api/workflows/${workflowId}`
          : 'http://localhost:5000/api/workflows',
        {
          method: workflowId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        },
      )
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setNotice(
          result?.message ??
            'Draft saved in this browser, but backend save failed.',
        )
        return null
      }

      if (typeof result?._id !== 'string') {
        setNotice('Backend responded, but no workflow ID was returned.')
        return null
      }

      const savedId: string = result._id
      setWorkflowId(savedId)

      localStorage.setItem(
        'flowpilot-workflow',
        JSON.stringify({ ...draft, _id: savedId }),
      )

      setNotice('Workflow saved successfully to the database!')
      return savedId
    } catch {
      setNotice('Draft saved in this browser. Could not connect to backend.')
      return null
    }
  }
  const runWorkflow = async () => {
    if (isRunning) return

    const errors = validateWorkflow(
      workflowName,
      workflowNodes,
      flowEdges,
    )

    setValidationErrors(errors)
    setShowValidation(true)

    if (errors.length > 0) {
      setNotice('Workflow cannot run. Fix the validation errors first.')
      return
    }

    const confirmed = window.confirm(
      `Save and run workflow "${workflowName.trim()}" with ${workflowNodes.length} nodes?`,
    )

    if (!confirmed) return

    setIsRunning(true)
    setNotice('Saving workflow before execution...')

    try {
      const savedId = await saveWorkflow()

      if (!savedId) return
      const response = await fetch(
        `http://localhost:5000/api/workflows/${savedId}/run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setNotice(
          result?.message ?? 'Workflow was saved, but execution failed to start.',
        )
        return
      }

      setNotice('Workflow execution started successfully!')
      await loadExecutions(savedId)
    } catch {
      setNotice('Could not connect to the backend to run this workflow.')
    } finally {
      setIsRunning(false)
    }
  }
  const loadExecutions = async (id = workflowId) => {
    if (!id) {
      setExecutions([])
      return
    }

    setIsLoadingExecutions(true)

    try {
      const response = await fetch(
        `http://localhost:5000/api/workflows/${id}/executions`,
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setNotice('Could not load workflow executions.')
        return
      }

      const items = Array.isArray(result)
        ? result
        : Array.isArray(result?.executions)
          ? result.executions
          : []

      setExecutions(items)
    } catch {
      setNotice('Could not connect to the backend to load executions.')
    } finally {
      setIsLoadingExecutions(false)
    }
  }
  useEffect(() => {
    const savedDraft = localStorage.getItem('flowpilot-workflow')

    if (!savedDraft) return

    try {
      const parsed = JSON.parse(savedDraft)

      if (typeof parsed.name === 'string') {
        setWorkflowName(parsed.name)
      }

      if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        setWorkflowNodes(parsed.nodes)
        setFlowNodes(createFlowNodes(parsed.nodes))

        const savedEdges = Array.isArray(parsed.edges)
          ? parsed.edges
          : createFlowEdges(parsed.nodes)

        setFlowEdges(savedEdges)

        if (typeof parsed._id === 'string') {
          setWorkflowId(parsed._id)
        }
      }
    } catch {
      localStorage.removeItem('flowpilot-workflow')
    }
  }, [])
  const handleWorkflowNameChange = (value: string) => {
    setUndoStack((stack) => [...stack, createSnapshot()].slice(-30))
    setRedoStack([])
    setWorkflowName(value)
    setValidationErrors([])
    setShowValidation(false)
  }

  const selectNode = (nodeId: string) => {
    const numericId = Number(nodeId)

    if (Number.isFinite(numericId)) {
      setSelectedNode(numericId)
      setSelectedEdge(null)
    }
  }

  

  const startNodeCount = workflowNodes.filter(
    (node) => node.type === 'Start',
  ).length

  const taskNodeCount = workflowNodes.filter(
    (node) => node.type === 'Task',
  ).length

  const endNodeCount = workflowNodes.filter(
    (node) => node.type === 'End',
  ).length
  const changePage = (page: string) => {
    setActivePage(page)
    setNotice('')
  }

  const formatDate = (date?: string) => {
    if (!date) return 'Date unavailable'

    const parsedDate = new Date(date)

    if (Number.isNaN(parsedDate.getTime())) return 'Date unavailable'

    return parsedDate.toLocaleString()
  }

  const getStatusColor = (status: string) => {
    const normalized = status.toLowerCase()

    if (
      normalized.includes('success') ||
      normalized.includes('completed')
    ) {
      return '#16a34a'
    }

    if (
      normalized.includes('fail') ||
      normalized.includes('error')
    ) {
      return '#dc2626'
    }

    if (
      normalized.includes('running') ||
      normalized.includes('pending')
    ) {
      return '#d97706'
    }

    return '#64748b'
  }
  const pageTitle =
    activePage === 'Workflow Editor'
      ? 'Workflow Editor'
      : activePage

  const pageDescription =
    activePage === 'Workflow Editor'
      ? 'Design, connect, validate, and run your workflow.'
      : activePage === 'Dashboard'
        ? 'Monitor your workflow activity at a glance.'
        : activePage === 'Executions'
          ? 'Review recent workflow execution history.'
          : 'Review workflow validation and safety checks.'
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <GitBranch size={24} />
          </div>
          <div>
            <h1>FlowPilot</h1>
            <p>Workflow Automation</p>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          <button
            className={activePage === 'Dashboard' ? 'nav-item active' : 'nav-item'}
            onClick={() => changePage('Dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            className={
              activePage === 'Workflow Editor'
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() => changePage('Workflow Editor')}
          >
            <Workflow size={18} />
            <span>Workflow Editor</span>
          </button>

          <button
            className={activePage === 'Executions' ? 'nav-item active' : 'nav-item'}
            onClick={() => changePage('Executions')}
          >
            <Activity size={18} />
            <span>Executions</span>
          </button>

          <button
            className={
              activePage === 'Safety Center'
                ? 'nav-item active'
                : 'nav-item'
            }
            onClick={() => changePage('Safety Center')}
          >
            <ShieldCheck size={18} />
            <span>Safety Center</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="streak-card">
            <div className="streak-icon">
              <Flame size={20} />
            </div>
            <div>
              <strong>Keep building!</strong>
              <p>Your workflow journey</p>
            </div>
          </div>

          <div className="profile-card">
            <div className="profile-avatar">S</div>
            <div className="profile-details">
              <strong>Workspace Owner</strong>
              <span>Personal workspace</span>
            </div>
            <Settings size={18} />
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-heading">
            <span className="breadcrumb">FlowPilot / Workspace /</span>
            <h2>{pageTitle}</h2>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <Search size={17} />
              <input
                type="text"
                placeholder="Search workflow nodes..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <button
              className="icon-button"
              title="Notifications"
              onClick={() => setNotice('You are all caught up!')}
            >
              <Bell size={19} />
            </button>

            <div className="topbar-avatar">S</div>
          </div>
        </header>

        <section className="page-content">
          <div className="page-heading">
            <div>
              <h1>{pageTitle}</h1>
              <p>{pageDescription}</p>
            </div>
          </div>

          {notice && (
            <div className="notice-banner" role="status">
              <span>{notice}</span>
              <button
                className="notice-close"
                onClick={() => setNotice('')}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {activePage === 'Workflow Editor' && (
            <>
              <div className="editor-toolbar">
                <div className="workflow-name-field">
                  <label htmlFor="workflow-name">Workflow name</label>
                  <input
                    id="workflow-name"
                    value={workflowName}
                    onChange={(event) =>
                      handleWorkflowNameChange(event.target.value)
                    }
                    placeholder="Enter workflow name"
                  />
                </div>

                <div className="toolbar-actions">
                  <button
                    className="secondary-button"
                    onClick={undoChange}
                    disabled={undoStack.length === 0}
                    title="Undo"
                  >
                    <Undo2 size={16} />
                    Undo
                  </button>

                  <button
                    className="secondary-button"
                    onClick={redoChange}
                    disabled={redoStack.length === 0}
                    title="Redo"
                  >
                    <Redo2 size={16} />
                    Redo
                  </button>

                  <button className="secondary-button" onClick={addTask}>
                    <Plus size={16} />
                    Add Task
                  </button>

                  <button className="secondary-button" onClick={saveWorkflow}>
                    <Save size={16} />
                    Save
                  </button>

                  <button
                    className="primary-button"
                    onClick={runWorkflow}
                    disabled={isRunning}
                  >
                    <Play size={16} />
                    {isRunning ? 'Running...' : 'Run Workflow'}
                  </button>
                </div>
              </div>
              <div className="workflow-summary">
                <div className="summary-card">
                  <span className="summary-icon start-summary">
                    <Play size={18} />
                  </span>
                  <div>
                    <span>Start Nodes</span>
                    <strong>{startNodeCount}</strong>
                  </div>
                </div>

                <div className="summary-card">
                  <span className="summary-icon task-summary">
                    <Workflow size={18} />
                  </span>
                  <div>
                    <span>Task Nodes</span>
                    <strong>{taskNodeCount}</strong>
                  </div>
                </div>

                <div className="summary-card">
                  <span className="summary-icon end-summary">
                    <CheckCircle size={18} />
                  </span>
                  <div>
                    <span>End Nodes</span>
                    <strong>{endNodeCount}</strong>
                  </div>
                </div>

                <div className="summary-card">
                  <span className="summary-icon connection-summary">
                    <GitBranch size={18} />
                  </span>
                  <div>
                    <span>Connections</span>
                    <strong>{flowEdges.length}</strong>
                  </div>
                </div>
              </div>
              <div className="editor-layout">
                <section className="canvas-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Workflow Canvas</h3>
                      <p>Connect nodes to define your workflow.</p>
                    </div>

                    <button
                      className="canvas-tool-button"
                      onClick={() => setShowColorLegend((visible) => !visible)}
                      title="Toggle node color legend"
                    >
                      <Palette size={17} />
                    </button>
                  </div>

                  {showColorLegend && (
                    <div className="color-legend">
                      <span><i className="legend-dot start-dot" /> Start</span>
                      <span><i className="legend-dot task-dot" /> Task</span>
                      <span><i className="legend-dot new-dot" /> New Task</span>
                      <span><i className="legend-dot end-dot" /> End</span>
                    </div>
                  )}

                  <div className="flow-canvas">
                    <ReactFlow
                      nodes={flowNodes}
                      edges={flowEdges.map((edge) => ({
                        ...edge,
                        selected: edge.id === selectedEdge,
                      }))}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      onNodeClick={(_, node) => selectNode(node.id)}
                      onEdgeClick={(_, edge) => setSelectedEdge(edge.id)}
                      onPaneClick={() => {
                        setSelectedEdge(null)
                      }}
                      fitView
                      fitViewOptions={{ padding: 0.2 }}
                      nodesDraggable
                      nodesConnectable
                      elementsSelectable
                    >
                      <Background gap={20} size={1} />
                      <Controls />
                      <MiniMap pannable zoomable />
                    </ReactFlow>
                  </div>
                  <div className="canvas-footer">
                    <span>
                      <span className="live-dot" /> Canvas ready
                    </span>
                    <span>{flowNodes.length} nodes · {flowEdges.length} connections</span>
                  </div>
                </section>

                <aside className="properties-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Node Properties</h3>
                      <p>Edit the selected node.</p>
                    </div>
                  </div>

                  {currentNode ? (
                    <div className="properties-content">
                      <div className="selected-node-badge">
                        <span className={`node-type-dot ${currentNode.type.toLowerCase()}-dot`} />
                        {currentNode.type} Node
                      </div>

                      <label htmlFor="node-title">Node name</label>
                      <input
                        id="node-title"
                        value={currentNode.title}
                        onChange={(event) => {
                          const updatedNodes = workflowNodes.map((node) =>
                            node.id === currentNode.id
                              ? { ...node, title: event.target.value }
                              : node,
                          )
                          syncWorkflow(updatedNodes)
                        }}
                        placeholder="Enter node name"
                      />

                      <label htmlFor="node-description">Description</label>
                      <textarea
                        id="node-description"
                        rows={4}
                        value={currentNode.description}
                        onChange={(event) => {
                          const updatedNodes = workflowNodes.map((node) =>
                            node.id === currentNode.id
                              ? { ...node, description: event.target.value }
                              : node,
                          )
                          syncWorkflow(updatedNodes)
                        }}
                        placeholder="Describe this node"
                      />

                      <div className="property-divider" />

                      <div className="property-info-row">
                        <span>Node ID</span>
                        <strong>#{currentNode.id}</strong>
                      </div>

                      <div className="property-info-row">
                        <span>Node type</span>
                        <strong>{currentNode.type}</strong>
                      </div>
                      <div className="property-divider" />

                      <button
                        className="secondary-button full-width-button"
                        onClick={undoDeleteTask}
                        disabled={!deletedTask}
                      >
                        <Undo2 size={16} />
                        Restore Deleted Task
                      </button>

                      <button
                        className="danger-button full-width-button"
                        onClick={deleteTask}
                        disabled={currentNode.type !== 'Task'}
                      >
                        <Trash2 size={16} />
                        Delete Task
                      </button>

                      <button
                        className="danger-button full-width-button"
                        onClick={deleteSelectedConnection}
                        disabled={!selectedEdge}
                      >
                        <X size={16} />
                        Delete Selected Connection
                      </button>

                      <p className="property-help">
                        Select a node or connection on the canvas to edit or remove it.
                      </p>
                    </div>
                  ) : (
                    <div className="empty-properties">
                      <Workflow size={30} />
                      <h4>No node selected</h4>
                      <p>Select a node on the canvas to view its properties.</p>
                    </div>
                  )}
                </aside>
              </div>
                            <div className="editor-bottom-grid">
                <section className="bottom-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>
                        <ShieldCheck size={18} />
                        Workflow Safety
                      </h3>
                      <p>Check your workflow before execution.</p>
                    </div>
                  </div>

                  {showValidation && validationErrors.length > 0 ? (
                    <div className="validation-list">
                      {validationErrors.map((error, index) => (
                        <div className="validation-item" key={`${error}-${index}`}>
                          <AlertTriangle size={16} />
                          <span>{error}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="safety-success">
                      <CheckCircle size={18} />
                      <div>
                        <strong>
                          {showValidation
                            ? 'Validation passed'
                            : 'Ready for validation'}
                        </strong>
                        <p>
                          {showValidation
                            ? 'No workflow validation errors were found.'
                            : 'Save or run your workflow to validate its configuration.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    className="secondary-button"
                    onClick={() => {
                      const errors = validateWorkflow(
                        workflowName,
                        workflowNodes,
                        flowEdges,
                      )
                      setValidationErrors(errors)
                      setShowValidation(true)
                      setNotice(
                        errors.length === 0
                          ? 'Workflow validation passed!'
                          : `Found ${errors.length} validation issue(s).`,
                      )
                    }}
                  >
                    <ShieldCheck size={16} />
                    Validate Workflow
                  </button>
                </section>
                <section className="bottom-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>
                        <Activity size={18} />
                        Recent Executions
                      </h3>
                      <p>Latest runs for this workflow.</p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => loadExecutions()}
                      disabled={isLoadingExecutions}
                    >
                      {isLoadingExecutions ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>

                  {executions.length > 0 ? (
                    <div className="execution-list">
                      {executions.slice(0, 4).map((execution) => (
                        <div
                          className="execution-row"
                          key={execution._id}
                        >
                          <div className="execution-status-icon">
                            <Activity size={17} />
                          </div>

                          <div className="execution-details">
                            <strong>
                              Execution {execution._id.slice(-6)}
                            </strong>
                            <span>{formatDate(execution.startedAt)}</span>
                          </div>

                          <span
                            className="status-pill"
                            style={{
                              color: getStatusColor(execution.status),
                            }}
                          >
                            {execution.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-executions">
                      <Activity size={24} />
                      <p>
                        {isLoadingExecutions
                          ? 'Loading executions...'
                          : 'No executions found yet.'}
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {activePage === 'Dashboard' && (
            <div className="page-section">
              <div className="workflow-summary">
                <div className="summary-card">
                  <span className="summary-icon start-summary">
                    <Workflow size={18} />
                  </span>
                  <div>
                    <span>Current Workflow</span>
                    <strong>{workflowName}</strong>
                  </div>
                </div>

                <div className="summary-card">
                  <span className="summary-icon task-summary">
                    <Activity size={18} />
                  </span>
                  <div>
                    <span>Total Nodes</span>
                    <strong>{workflowNodes.length}</strong>
                  </div>
                </div>

                <div className="summary-card">
                  <span className="summary-icon end-summary">
                    <CheckCircle size={18} />
                  </span>
                  <div>
                    <span>Connections</span>
                    <strong>{flowEdges.length}</strong>
                  </div>
                </div>

                <div className="summary-card">
                  <span className="summary-icon connection-summary">
                    <Play size={18} />
                  </span>
                  <div>
                    <span>Executions Loaded</span>
                    <strong>{executions.length}</strong>
                  </div>
                </div>
              </div>

              <section className="bottom-panel standalone-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Quick Actions</h3>
                    <p>Continue building your workflow.</p>
                  </div>
                </div>

                <div className="quick-actions">
                  <button
                    className="secondary-button"
                    onClick={() => changePage('Workflow Editor')}
                  >
                    <Workflow size={17} />
                    Open Editor
                  </button>

                  <button
                    className="secondary-button"
                    onClick={addTask}
                  >
                    <Plus size={17} />
                    Add Task
                  </button>

                  <button
                    className="primary-button"
                    onClick={runWorkflow}
                    disabled={isRunning}
                  >
                    <Play size={17} />
                    {isRunning ? 'Running...' : 'Run Workflow'}
                  </button>
                </div>
              </section>
            </div>
          )}
          {activePage === 'Executions' && (
            <section className="bottom-panel standalone-panel">
              <div className="panel-heading">
                <div>
                  <h3>Execution History</h3>
                  <p>Review the runs recorded for your workflow.</p>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => loadExecutions()}
                  disabled={isLoadingExecutions}
                >
                  <Activity size={16} />
                  {isLoadingExecutions ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {executions.length > 0 ? (
                <div className="execution-list">
                  {executions.map((execution) => (
                    <div
                      className="execution-row"
                      key={execution._id}
                    >
                      <div className="execution-status-icon">
                        <Activity size={17} />
                      </div>

                      <div className="execution-details">
                        <strong>Execution {execution._id}</strong>
                        <span>{formatDate(execution.startedAt)}</span>
                      </div>

                      <span
                        className="status-pill"
                        style={{
                          color: getStatusColor(execution.status),
                        }}
                      >
                        {execution.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-executions">
                  <Activity size={24} />
                  <p>
                    {isLoadingExecutions
                      ? 'Loading executions...'
                      : 'No execution history is available yet.'}
                  </p>
                </div>
              )}
            </section>
          )}
          
          {activePage === 'Safety Center' && (
            <div className="safety-page-grid">
              <section className="bottom-panel standalone-panel">
                <div className="panel-heading">
                  <div>
                    <h3>
                      <ShieldCheck size={19} />
                      Workflow Safety Center
                    </h3>
                    <p>Review basic workflow configuration checks.</p>
                  </div>
                </div>

                <div className="safety-check-row">
                  {startNodeCount === 1 ? (
                    <CheckCircle size={19} />
                  ) : (
                    <AlertTriangle size={19} />
                  )}
                  <div>
                    <strong>Start node check</strong>
                    <p>
                      {startNodeCount === 1
                        ? 'Exactly one Start node is configured.'
                        : `Found ${startNodeCount} Start nodes; exactly one is required.`}
                    </p>
                  </div>
                </div>

                <div className="safety-check-row">
                  {endNodeCount === 1 ? (
                    <CheckCircle size={19} />
                  ) : (
                    <AlertTriangle size={19} />
                  )}
                  <div>
                    <strong>End node check</strong>
                    <p>
                      {endNodeCount === 1
                        ? 'Exactly one End node is configured.'
                        : `Found ${endNodeCount} End nodes; exactly one is required.`}
                    </p>
                  </div>
                </div>

                <div className="safety-check-row">
                  {flowEdges.length > 0 ? (
                    <CheckCircle size={19} />
                  ) : (
                    <AlertTriangle size={19} />
                  )}
                  <div>
                    <strong>Connection check</strong>
                    <p>
                      {flowEdges.length > 0
                        ? `${flowEdges.length} connection(s) are configured.`
                        : 'No connections are configured yet.'}
                    </p>
                  </div>
                </div>

                <button
                  className="primary-button"
                  onClick={() => {
                    const errors = validateWorkflow(
                      workflowName,
                      workflowNodes,
                      flowEdges,
                    )
                    setValidationErrors(errors)
                    setShowValidation(true)
                    setNotice(
                      errors.length === 0
                        ? 'Safety checks passed.'
                        : `Safety check found ${errors.length} issue(s).`,
                    )
                  }}
                >
                  <ShieldCheck size={17} />
                  Run Safety Checks
                </button>
              </section>
            </div>
          )}

          <footer className="page-footer">
            <span>FlowPilot · Workflow Automation</span>
            <span>Built for safer workflows</span>
          </footer>
        </section>
      </main>
    </div>
  )
}


export default App