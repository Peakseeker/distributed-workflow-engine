
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

const initialWorkflowEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
  },
]

function createFlowNodes(nodes: WorkflowNode[]): Node<FlowNodeData>[] {
  return nodes.map((node) => ({
    id: String(node.id),
    type: 'default',
    position: {
      x: node.type === 'Start' ? 100 : node.type === 'Task' ? 350 : 600,
      y: 150,
    },
    data: { label: `${node.type}: ${node.title}` },
    style: {
      borderRadius: '14px',
      padding: '14px',
      border: '1px solid #d8dff0',
      background:
        node.type === 'Start'
          ? '#e0f2fe'
          : node.type === 'End'
            ? '#dcfce7'
            : '#f3e8ff',
      color: '#243047',
      minWidth: 150,
      fontWeight: 600,
    },
  }))
}

function validateWorkflow(
  name: string,
  nodes: WorkflowNode[],
  edges: Edge[],
): string[] {
  const errors: string[] = []

  if (!name.trim()) {
    errors.push('Workflow name is required.')
  }

  if (nodes.length === 0) {
    errors.push('Add at least one workflow node.')
  }

  if (!nodes.some((node) => node.type === 'Start')) {
    errors.push('Workflow needs a Start node.')
  }

  if (!nodes.some((node) => node.type === 'End')) {
    errors.push('Workflow needs an End node.')
  }

  const nodeIds = new Set(nodes.map((node) => String(node.id)))

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      errors.push('A connection points to a missing node.')
      break
    }
  }

  return errors
}

export default function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [workflowName, setWorkflowName] = useState('My Workflow')
  const [workflowNodes, setWorkflowNodes] =
    useState<WorkflowNode[]>(initialWorkflowNodes)
  const [flowNodes, setFlowNodes] =
    useState<Node<FlowNodeData>[]>(createFlowNodes(initialWorkflowNodes))
  const [flowEdges, setFlowEdges] =
    useState<Edge[]>(initialWorkflowEdges)

  const [workflowId, setWorkflowId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('flowpilot-workflow')
      if (saved) {
        const parsed = JSON.parse(saved)
        return typeof parsed._id === 'string' ? parsed._id : null
      }
    } catch {
      // Ignore invalid local data.
    }
    return null
  })

  const [executions, setExecutions] = useState<Execution[]>([])
  const [notice, setNotice] = useState('')
  const [searchText, setSearchText] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(2)
  const [isRunning, setIsRunning] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [history, setHistory] = useState<WorkflowSnapshot[]>([])
  const [future, setFuture] = useState<WorkflowSnapshot[]>([])

  const selectedNode =
    workflowNodes.find((node) => node.id === selectedNodeId) ?? null

  const pushHistory = useCallback(() => {
    setHistory((previous) => [
      ...previous,
      {
        name: workflowName,
        nodes: workflowNodes.map((node) => ({ ...node })),
        edges: flowEdges.map((edge) => ({ ...edge })),
      },
    ])
    setFuture([])
  }, [workflowName, workflowNodes, flowEdges])

  useEffect(() => {
    setFlowNodes(createFlowNodes(workflowNodes))
  }, [workflowNodes])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('flowpilot-workflow')
      if (!saved) return

      const parsed = JSON.parse(saved)
      if (typeof parsed.name === 'string') {
        setWorkflowName(parsed.name)
      }
      if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        setWorkflowNodes(parsed.nodes)
        setFlowNodes(createFlowNodes(parsed.nodes))
      }
      if (Array.isArray(parsed.edges)) {
        setFlowEdges(parsed.edges)
      }
      if (typeof parsed._id === 'string') {
        setWorkflowId(parsed._id)
      }
    } catch {
      setNotice('Could not restore the saved browser draft.')
    }
  }, [])

  const onNodesChange = useCallback((changes: NodeChange<Node<FlowNodeData>>[]) => {
    setFlowNodes((nodes) => applyNodeChanges(changes, nodes))
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setFlowEdges((edges) => applyEdgeChanges(changes, edges))
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    setFlowEdges((edges) =>
      addEdge(
        {
          ...connection,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
        },
        edges,
      ),
    )
  }, [])

  const saveWorkflow = async (): Promise<string | null> => {
    const errors = validateWorkflow(
      workflowName,
      workflowNodes,
      flowEdges,
    )

    setValidationErrors(errors)
    setShowValidation(true)

    if (errors.length > 0) {
      setNotice('Please fix the workflow validation errors first.')
      return null
    }

    const draft = {
      name: workflowName.trim(),
      nodes: workflowNodes.map((node) => ({ ...node, isNew: false })),
      edges: flowEdges,
      status: 'draft',
    }

    localStorage.setItem(
      'flowpilot-workflow',
      JSON.stringify({
        ...draft,
        _id: workflowId ?? undefined,
      }),
    )

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
          result?.message ?? 'Backend save failed. Browser draft is saved.',
        )
        return null
      }

      if (typeof result?._id === 'string') {
        setWorkflowId(result._id)

        localStorage.setItem(
          'flowpilot-workflow',
          JSON.stringify({ ...draft, _id: result._id }),
        )

        setWorkflowNodes(draft.nodes)
        setFlowNodes(createFlowNodes(draft.nodes))
        setNotice('Workflow saved successfully!')
        return result._id
      }

      setNotice('Saved response did not include a workflow ID.')
      return null
    } catch {
      setNotice('Backend is unavailable. Your browser draft is saved.')
      return null
    }
  }

  const loadExecutions = async () => {
    try {
      const response = await fetch(
        'http://localhost:5000/api/workflows/executions',
      )

      if (!response.ok) {
        throw new Error('Could not load execution history.')
      }

      const result = await response.json()

      setExecutions(
        Array.isArray(result) ? result : result.executions ?? [],
      )
    } catch {
      setNotice('Could not load executions. Check that the backend is running.')
    }
  }

  const runWorkflow = async () => {
    const errors = validateWorkflow(
      workflowName,
      workflowNodes,
      flowEdges,
    )

    setValidationErrors(errors)
    setShowValidation(true)

    if (errors.length > 0) {
      setNotice('Please fix the workflow errors before running.')
      return
    }

    if (!window.confirm('Do you want to run this workflow?')) {
      return
    }

    setIsRunning(true)

    try {
      const savedId = await saveWorkflow()

      if (!savedId) {
        return
      }

      const response = await fetch(
        `http://localhost:5000/api/workflows/${savedId}/run`,
        { method: 'POST' },
      )

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setNotice(result?.message ?? 'Workflow run failed.')
        return
      }

      setNotice('Workflow run request completed. Check execution history.')
      await loadExecutions()
    } catch {
      setNotice('Could not run workflow. Check the backend connection.')
    } finally {
      setIsRunning(false)
    }
  }

  const addTask = () => {
    pushHistory()

    const nextId =
      Math.max(0, ...workflowNodes.map((node) => node.id)) + 1

    const newTask: WorkflowNode = {
      id: nextId,
      type: 'Task',
      title: 'New Task',
      description: 'Configure this task.',
      isNew: true,
    }

    setWorkflowNodes((nodes) => {
      const endIndex = nodes.findIndex((node) => node.type === 'End')

      if (endIndex === -1) return [...nodes, newTask]

      const updated = [...nodes]
      updated.splice(endIndex, 0, newTask)
      return updated
    })

    setFlowEdges((edges) => [
      ...edges,
      {
        id: `e${nextId - 1}-${nextId}`,
        source: String(nextId - 1),
        target: String(nextId),
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ])

    setSelectedNodeId(nextId)
    setNotice('New task added.')
  }

  const deleteSelectedTask = () => {
    if (selectedNodeId === null) {
      setNotice('Select a task first.')
      return
    }

    const selected = workflowNodes.find(
      (node) => node.id === selectedNodeId,
    )

    if (!selected || selected.type !== 'Task') {
      setNotice('Only Task nodes can be deleted.')
      return
    }

    pushHistory()

    setWorkflowNodes((nodes) =>
      nodes.filter((node) => node.id !== selectedNodeId),
    )

    setFlowEdges((edges) =>
      edges.filter(
        (edge) =>
          edge.source !== String(selectedNodeId) &&
          edge.target !== String(selectedNodeId),
      ),
    )

    setSelectedNodeId(null)
    setNotice('Task deleted.')
  }

  const undoChange = () => {
    if (history.length === 0) {
      setNotice('Nothing to undo.')
      return
    }

    const previous = history[history.length - 1]

    setFuture((items) => [
      ...items,
      {
        name: workflowName,
        nodes: workflowNodes.map((node) => ({ ...node })),
        edges: flowEdges.map((edge) => ({ ...edge })),
      },
    ])

    setWorkflowName(previous.name)
    setWorkflowNodes(previous.nodes)
    setFlowEdges(previous.edges)
    setHistory((items) => items.slice(0, -1))
    setNotice('Last change undone.')
  }

  const redoChange = () => {
    if (future.length === 0) {
      setNotice('Nothing to redo.')
      return
    }

    const next = future[future.length - 1]

    setHistory((items) => [
      ...items,
      {
        name: workflowName,
        nodes: workflowNodes.map((node) => ({ ...node })),
        edges: flowEdges.map((edge) => ({ ...edge })),
      },
    ])

    setWorkflowName(next.name)
    setWorkflowNodes(next.nodes)
    setFlowEdges(next.edges)
    setFuture((items) => items.slice(0, -1))
    setNotice('Change restored.')
  }

  const updateSelectedNode = (field: 'title' | 'description', value: string) => {
    if (selectedNodeId === null) return

    pushHistory()

    setWorkflowNodes((nodes) =>
      nodes.map((node) =>
        node.id === selectedNodeId
          ? { ...node, [field]: value }
          : node
      )
    )

    setNotice('Node details updated.')
  }

  const selectPage = (page: string) => {
    setActivePage(page)

    if (page === 'Executions') {
      void loadExecutions()
    }

    if (page === 'Workflows') {
      setNotice('Workflow editor opened.')
    } else {
      setNotice('')
    }
  }

  const handleCanvasNodeClick = (_event: unknown, node: Node) => {
    setSelectedNodeId(Number(node.id))
  }


  const deleteSelectedConnection = () => {
    if (selectedNodeId === null) {
      setNotice('Select a task first.')
      return
    }

    const selected = workflowNodes.find(
      (node) => node.id === selectedNodeId
    )

    if (!selected || selected.type !== 'Task') {
      setNotice('Select a Task node to delete it.')
      return
    }

    deleteSelectedTask()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <GitBranch size={24} />
          </div>
          <div>
            <h2>FlowPilot</h2>
            <span>Workflow Studio</span>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          <button
            className={activePage === 'Dashboard' ? 'nav-item active' : 'nav-item'}
            onClick={() => selectPage('Dashboard')}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>

          <button
            className={activePage === 'Workflows' ? 'nav-item active' : 'nav-item'}
            onClick={() => selectPage('Workflows')}
          >
            <Workflow size={19} />
            <span>Workflows</span>
          </button>

          <button
            className={activePage === 'Executions' ? 'nav-item active' : 'nav-item'}
            onClick={() => selectPage('Executions')}
          >
            <Activity size={19} />
            <span>Executions</span>
          </button>

          <button
            className={activePage === 'Safety Center' ? 'nav-item active' : 'nav-item'}
            onClick={() => selectPage('Safety Center')}
          >
            <ShieldCheck size={19} />
            <span>Safety Center</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="streak-card">
            <div className="streak-icon">
              <Flame size={23} />
            </div>
            <div>
              <strong>Work Streak</strong>
              <p>Keep your momentum going!</p>
              <div className="streak-days">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>
            </div>
          </div>

          <button
            className="nav-item settings-link"
            onClick={() => setNotice('Settings are coming soon.')}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="profile-card">
            <div className="profile-avatar">S</div>
            <div className="profile-info">
              <strong>Workspace Owner</strong>
              <span>Personal workspace</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-actions">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>

            <button
              className="icon-button"
              title="Notifications"
              onClick={() => setNotice('You are all caught up!')}
            >
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice-banner">
            <CheckCircle size={18} />
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Dismiss notice">
              <X size={17} />
            </button>
          </div>
        )}

        {activePage === 'Dashboard' && (
          <section className="page-content">
            <div className="page-heading">
              <div>
                <span className="eyebrow">YOUR WORKSPACE</span>
                <h1>Good to see you again 👋</h1>
                <p>Build, manage and monitor your automated workflows.</p>
              </div>

              <button
                className="primary-button"
                onClick={() => selectPage('Workflows')}
              >
                <Plus size={18} />
                Create Workflow
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-top">
                  <span>Total Workflows</span>
                  <div className="stat-icon purple">
                    <Workflow size={20} />
                  </div>
                </div>
                <h2>{workflowId ? '1' : '0'}</h2>
                <p>Your current saved workflow</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>Total Executions</span>
                  <div className="stat-icon blue">
                    <Activity size={20} />
                  </div>
                </div>
                <h2>{executions.length}</h2>
                <p>Execution records loaded</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>Workflow Nodes</span>
                  <div className="stat-icon green">
                    <GitBranch size={20} />
                  </div>
                </div>
                <h2>{workflowNodes.length}</h2>
                <p>Nodes in the current workflow</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>Safety Status</span>
                  <div className="stat-icon orange">
                    <ShieldCheck size={20} />
                  </div>
                </div>
                <h2>Protected</h2>
                <p>Workflow validation available</p>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="panel recent-workflows">
                <div className="panel-heading">
                  <div>
                    <h3>Recent Workflow</h3>
                    <p>Continue where you left off.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => selectPage('Workflows')}
                  >
                    Open editor
                  </button>
                </div>

                <div className="workflow-list-item">
                  <div className="workflow-list-icon">
                    <Workflow size={23} />
                  </div>
                  <div className="workflow-list-details">
                    <strong>{workflowName}</strong>
                    <span>{workflowNodes.length} nodes · Visual workflow</span>
                  </div>
                  <span className="status-pill">Draft</span>
                  <button
                    className="icon-button small"
                    title="Edit workflow"
                    onClick={() => selectPage('Workflows')}
                  >
                    <Settings size={17} />
                  </button>
                </div>

                <div className="workflow-preview">
                  <div className="preview-node start-preview">Start</div>
                  <div className="preview-line" />
                  <div className="preview-node task-preview">Task</div>
                  <div className="preview-line" />
                  <div className="preview-node end-preview">End</div>
                </div>
              </div>

              <div className="panel quick-actions">
                <div className="panel-heading">
                  <div>
                    <h3>Quick Actions</h3>
                    <p>What would you like to do?</p>
                  </div>
                </div>

                <button
                  className="quick-action-item"
                  onClick={() => selectPage('Workflows')}
                >
                  <div className="quick-action-icon purple">
                    <Plus size={20} />
                  </div>
                  <div>
                    <strong>Create a workflow</strong>
                    <span>Design a new automation</span>
                  </div>
                </button>

                <button
                  className="quick-action-item"
                  onClick={() => {
                    selectPage('Workflows')
                    addTask()
                  }}
                >
                  <div className="quick-action-icon blue">
                    <GitBranch size={20} />
                  </div>
                  <div>
                    <strong>Add a task</strong>
                    <span>Extend your current workflow</span>
                  </div>
                </button>

                <button
                  className="quick-action-item"
                  onClick={() => selectPage('Executions')}
                >
                  <div className="quick-action-icon green">
                    <Activity size={20} />
                  </div>
                  <div>
                    <strong>View executions</strong>
                    <span>Check workflow run history</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="panel safety-summary">
              <div className="safety-summary-icon">
                <ShieldCheck size={25} />
              </div>
              <div className="safety-summary-text">
                <h3>Your workflow safety matters</h3>
                <p>
                  Validate workflow connections before saving or running.
                  Review execution history to monitor results.
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={() => selectPage('Safety Center')}
              >
                <ShieldCheck size={17} />
                Open Safety Center
              </button>
            </div>
          </section>
        )}

        {activePage === 'Workflows' && (
          <section className="page-content">
            <div className="page-heading">
              <div>
                <span className="eyebrow">WORKFLOW BUILDER</span>
                <h1>Workflow Editor</h1>
                <p>Design your automation visually, one step at a time.</p>
              </div>

              <div className="editor-actions">
                <button
                  className="secondary-button"
                  onClick={undoChange}
                  disabled={history.length === 0}
                  title="Undo"
                >
                  <Undo2 size={17} />
                </button>

                <button
                  className="secondary-button"
                  onClick={redoChange}
                  disabled={future.length === 0}
                  title="Redo"
                >
                  <Redo2 size={17} />
                </button>

                <button className="secondary-button" onClick={addTask}>
                  <Plus size={17} />
                  Add Task
                </button>

                <button className="primary-button" onClick={saveWorkflow}>
                  <Save size={17} />
                  Save
                </button>

                <button
                  className="run-button"
                  onClick={runWorkflow}
                  disabled={isRunning}
                >
                  <Play size={17} />
                  {isRunning ? 'Running...' : 'Run'}
                </button>
              </div>
            </div>

            <div className="editor-toolbar">
              <div className="workflow-name-field">
                <label htmlFor="workflow-name">Workflow name</label>
                <input
                  id="workflow-name"
                  value={workflowName}
                  onChange={(event) => setWorkflowName(event.target.value)}
                  placeholder="Enter workflow name"
                />
              </div>

              <div className="toolbar-info">
                <span className="live-indicator" />
                Visual Builder
                <span className="toolbar-separator">|</span>
                {workflowNodes.length} nodes
                <span className="toolbar-separator">|</span>
                {flowEdges.length} connections
              </div>
            </div>

            {showValidation && validationErrors.length > 0 && (
              <div className="validation-panel">
                <div className="validation-title">
                  <AlertTriangle size={19} />
                  <strong>Workflow needs attention</strong>
                </div>

                <ul>
                  {validationErrors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="editor-layout">
              <div className="canvas-panel">
                <div className="canvas-header">
                  <div>
                    <h3>Workflow Canvas</h3>
                    <p>Connect nodes to define your workflow.</p>
                  </div>

                  <div className="canvas-header-actions">
                    <span className="canvas-status">
                      <span className="live-indicator" />
                      Editable
                    </span>

                    <button
                      className="icon-button small"
                      title="Delete selected task"
                      onClick={deleteSelectedConnection}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="workflow-canvas">
                  <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={handleCanvasNodeClick}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                  >
                    <Background gap={20} size={1} />
                    <Controls />
                    <MiniMap />
                  </ReactFlow>
                </div>

                <div className="canvas-footer">
                  <span>
                    <GitBranch size={15} />
                    Drag nodes and connect their handles.
                  </span>

                  <button
                    className="text-button"
                    onClick={() => {
                      setWorkflowNodes(initialWorkflowNodes)
                      setFlowEdges(initialWorkflowEdges)
                      setSelectedNodeId(2)
                      setNotice('Workflow reset to the initial example.')
                    }}
                  >
                    Reset example
                  </button>
                </div>
              </div>

              <aside className="node-panel">
                <div className="node-panel-heading">
                  <div>
                    <span className="eyebrow">CONFIGURATION</span>
                    <h3>Node Information</h3>
                  </div>

                  <Palette size={20} />
                </div>

                {selectedNode ? (
                  <>
                    <div className={`node-type-badge ${selectedNode.type.toLowerCase()}`}>
                      <span className="node-type-dot" />
                      {selectedNode.type} Node
                    </div>

                    <div className="form-field">
                      <label htmlFor="node-title">Node title</label>
                      <input
                        id="node-title"
                        value={selectedNode.title}
                        onChange={(event) =>
                          updateSelectedNode('title', event.target.value)
                        }
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="node-description">Description</label>
                      <textarea
                        id="node-description"
                        rows={4}
                        value={selectedNode.description}
                        onChange={(event) =>
                          updateSelectedNode('description', event.target.value)
                        }
                      />
                    </div>

                    <div className="node-details-card">
                      <span>Node ID</span>
                      <strong>{selectedNode.id}</strong>

                      <span>Node type</span>
                      <strong>{selectedNode.type}</strong>

                      <span>Connections</span>
                      <strong>
                        {
                          flowEdges.filter(
                            (edge) =>
                              edge.source === String(selectedNode.id) ||
                              edge.target === String(selectedNode.id)
                          ).length
                        }
                      </strong>
                    </div>

                    {selectedNode.type === 'Task' && (
                      <button
                        className="delete-task-button"
                        onClick={deleteSelectedTask}
                      >
                        <Trash2 size={17} />
                        Delete this task
                      </button>
                    )}
                  </>
                ) : (
                  <div className="empty-selection">
                    <GitBranch size={30} />
                    <h4>No node selected</h4>
                    <p>Select a node on the canvas to view its details.</p>
                  </div>
                )}

                <div className="node-help-card">
                  <ShieldCheck size={19} />
                  <div>
                    <strong>Safety check</strong>
                    <p>Save and Run validate your workflow before continuing.</p>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        )}

        {activePage === 'Executions' && (
          <section className="page-content">
            <div className="page-heading">
              <div>
                <span className="eyebrow">MONITORING</span>
                <h1>Execution History</h1>
                <p>Track your workflow runs and review their status.</p>
              </div>

              <button
                className="secondary-button"
                onClick={() => void loadExecutions()}
              >
                <Activity size={17} />
                Refresh
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-top">
                  <span>Total Executions</span>
                  <div className="stat-icon purple">
                    <Activity size={20} />
                  </div>
                </div>
                <h2>{executions.length}</h2>
                <p>Records returned by the backend</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>Successful</span>
                  <div className="stat-icon green">
                    <CheckCircle size={20} />
                  </div>
                </div>
                <h2>
                  {
                    executions.filter((item) =>
                      ['success', 'completed', 'succeeded'].includes(
                        item.status.toLowerCase()
                      )
                    ).length
                  }
                </h2>
                <p>Completed execution records</p>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span>Failed</span>
                  <div className="stat-icon orange">
                    <AlertTriangle size={20} />
                  </div>
                </div>
                <h2>
                  {
                    executions.filter((item) =>
                      ['failed', 'error'].includes(item.status.toLowerCase())
                    ).length
                  }
                </h2>
                <p>Failed execution records</p>
              </div>
            </div>

            <div className="panel execution-panel">
              <div className="panel-heading">
                <div>
                  <h3>Recent Executions</h3>
                  <p>Execution information received from the backend.</p>
                </div>
              </div>

              {executions.length > 0 ? (
                <div className="execution-table-wrapper">
                  <table className="execution-table">
                    <thead>
                      <tr>
                        <th>Execution ID</th>
                        <th>Status</th>
                        <th>Started At</th>
                      </tr>
                    </thead>

                    <tbody>
                      {executions.map((execution) => (
                        <tr key={execution._id}>
                          <td>
                            <span className="execution-id">
                              {execution._id}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${execution.status.toLowerCase()}`}
                            >
                              {execution.status}
                            </span>
                          </td>
                          <td>
                            {execution.startedAt
                              ? new Date(execution.startedAt).toLocaleString()
                              : 'Not available'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Activity size={28} />
                  </div>
                  <h3>No executions yet</h3>
                  <p>
                    Run your workflow to see execution records here.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => selectPage('Workflows')}
                  >
                    <Play size={17} />
                    Open Workflow Editor
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {activePage === 'Safety Center' && (
          <section className="page-content">
            <div className="page-heading">
              <div>
                <span className="eyebrow">WORKSPACE PROTECTION</span>
                <h1>Safety Center</h1>
                <p>Review workflow validation and basic safety checks.</p>
              </div>

              <div className="safety-header-icon">
                <ShieldCheck size={30} />
              </div>
            </div>

            <div className="safety-hero">
              <div className="safety-hero-icon">
                <ShieldCheck size={32} />
              </div>
              <div>
                <span className="eyebrow">WORKFLOW VALIDATION</span>
                <h2>
                  {validateWorkflow(
                    workflowName,
                    workflowNodes,
                    flowEdges
                  ).length === 0
                    ? 'Your workflow passes basic checks'
                    : 'Your workflow needs attention'}
                </h2>
                <p>
                  Basic checks verify the workflow name, Start and End nodes,
                  and whether connections refer to existing nodes.
                </p>
              </div>
            </div>

            <div className="safety-check-list">
              <div className="safety-check-item">
                <div className="safety-check-icon">
                  <CheckCircle size={21} />
                </div>
                <div>
                  <strong>Workflow name</strong>
                  <p>A name is required before saving or running.</p>
                </div>
                <span
                  className={`status-pill ${
                    workflowName.trim() ? 'success' : 'failed'
                  }`}
                >
                  {workflowName.trim() ? 'Passed' : 'Needs attention'}
                </span>
              </div>

              <div className="safety-check-item">
                <div className="safety-check-icon">
                  <GitBranch size={21} />
                </div>
                <div>
                  <strong>Start and End nodes</strong>
                  <p>The workflow should have both entry and exit nodes.</p>
                </div>
                <span
                  className={`status-pill ${
                    workflowNodes.some((node) => node.type === 'Start') &&
                    workflowNodes.some((node) => node.type === 'End')
                      ? 'success'
                      : 'failed'
                  }`}
                >
                  {workflowNodes.some((node) => node.type === 'Start') &&
                  workflowNodes.some((node) => node.type === 'End')
                    ? 'Passed'
                    : 'Needs attention'}
                </span>
              </div>

              <div className="safety-check-item">
                <div className="safety-check-icon">
                  <Activity size={21} />
                </div>
                <div>
                  <strong>Connection references</strong>
                  <p>Connections must point to existing workflow nodes.</p>
                </div>
                <span
                  className={`status-pill ${
                    validateWorkflow(
                      workflowName,
                      workflowNodes,
                      flowEdges
                    ).some((error) =>
                      error.includes('connection points')
                    )
                      ? 'failed'
                      : 'success'
                  }`}
                >
                  {validateWorkflow(
                    workflowName,
                    workflowNodes,
                    flowEdges
                  ).some((error) => error.includes('connection points'))
                    ? 'Needs attention'
                    : 'Passed'}
                </span>
              </div>
            </div>

            <div className="panel safety-summary">
              <div className="safety-summary-icon">
                <AlertTriangle size={24} />
              </div>
              <div className="safety-summary-text">
                <h3>Important note</h3>
                <p>
                  These are basic frontend validation checks. They do not
                  guarantee security, tenant isolation, retry handling,
                  compensation, or production readiness.
                </p>
              </div>
            </div>

            <button
              className="primary-button"
              onClick={() => {
                const errors = validateWorkflow(
                  workflowName,
                  workflowNodes,
                  flowEdges
                )
                setValidationErrors(errors)
                setShowValidation(true)
                setNotice(
                  errors.length === 0
                    ? 'Basic workflow validation passed.'
                    : `Validation found ${errors.length} issue(s).`
                )
              }}
            >
              <ShieldCheck size={17} />
              Run Safety Check
            </button>
          </section>
        )}

      </main>
    </div>
  )
}
