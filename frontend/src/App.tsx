
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
  MoreHorizontal,
  Settings,
  Flame,
  Trash2,
  Undo2,
} from 'lucide-react'

import './App.css'

type NodeType = 'Start' | 'Task' | 'End'

type WorkflowNode = {
  id: number
  type: NodeType
  title: string
  description: string
}

type FlowNodeData = {
  label: string
}

type Execution = {
  _id: string
  status: string
  startedAt?: string
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

const createFlowNodes = (nodes: WorkflowNode[]): Node<FlowNodeData>[] => {
  return nodes.map((node, index) => ({
    id: String(node.id),
    type: 'default',
    position: {
      x: 100 + index * 230,
      y: 150,
    },
    data: {
      label: `${node.type}: ${node.title}`,
    },
    style: {
      width: 180,
      padding: 16,
      borderRadius: 12,
      border:
        node.type === 'Start'
          ? '2px solid #22c55e'
          : node.type === 'End'
            ? '2px solid #ef4444'
            : '2px solid #8b5cf6',
      background: '#ffffff',
      color: '#1f2937',
      fontWeight: 600,
    },
  }))
}

const createFlowEdges = (nodes: WorkflowNode[]): Edge[] => {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `e${node.id}-${nodes[index + 1].id}`,
    source: String(node.id),
    target: String(nodes[index + 1].id),
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    animated: true,
    style: {
      stroke: '#8b5cf6',
      strokeWidth: 2,
    },
  }))
}

function App() {
  const [activePage, setActivePage] = useState('Workflow Editor')
  const [selectedNode, setSelectedNode] = useState(2)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [workflowName, setWorkflowName] = useState('My First Workflow')
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [executions, setExecutions] = useState<Execution[]>([])
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false)

  const [workflowNodes, setWorkflowNodes] =
    useState<WorkflowNode[]>(initialWorkflowNodes)

  const [deletedTask, setDeletedTask] =
    useState<WorkflowNode | null>(null)

  const [flowNodes, setFlowNodes] =
    useState<Node<FlowNodeData>[]>(createFlowNodes(initialWorkflowNodes))

  const [flowEdges, setFlowEdges] =
    useState<Edge[]>(createFlowEdges(initialWorkflowNodes))

  const currentNode = workflowNodes.find(
    (node) => node.id === selectedNode,
  )

  const syncWorkflow = (nodes: WorkflowNode[]) => {
    setWorkflowNodes(nodes)
    setFlowNodes(createFlowNodes(nodes))
    setFlowEdges(createFlowEdges(nodes))
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
    }

    const updatedNodes = [...workflowNodes]
    updatedNodes.splice(
      endIndex === -1 ? updatedNodes.length : endIndex,
      0,
      newTask,
    )

    syncWorkflow(updatedNodes)
    setSelectedNode(newTask.id)
    setNotice('Task added successfully. Click Save to store changes.')
  }

  const deleteTask = () => {
    const nodeToDelete = workflowNodes.find(
      (node) => node.id === selectedNode,
    )

    if (!nodeToDelete || nodeToDelete.type !== 'Task') {
      setNotice('Only Task nodes can be deleted.')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${nodeToDelete.title}"?`,
    )

    if (!confirmed) return

    setDeletedTask(nodeToDelete)

    const updatedNodes = workflowNodes.filter(
      (node) => node.id !== selectedNode,
    )

    syncWorkflow(updatedNodes)

    const nextNode =
      updatedNodes.find((node) => node.type === 'Task') ??
      updatedNodes[0]

    if (nextNode) setSelectedNode(nextNode.id)

    setNotice(`${nodeToDelete.title} deleted. You can undo this action.`)
  }

  const undoDeleteTask = () => {
    if (!deletedTask) return

    if (workflowNodes.some((node) => node.id === deletedTask.id)) {
      setNotice('Cannot undo because this task ID is already in use.')
      return
    }

    const updatedNodes = [...workflowNodes]
    const endIndex = updatedNodes.findIndex(
      (node) => node.type === 'End',
    )

    updatedNodes.splice(
      endIndex === -1 ? updatedNodes.length : endIndex,
      0,
      deletedTask,
    )

    syncWorkflow(updatedNodes)
    setSelectedNode(deletedTask.id)
    setDeletedTask(null)
    setNotice('Task restored. Click Save to store the changes.')
  }

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<FlowNodeData>>[]) => {
      setFlowNodes((nodes) => applyNodeChanges(changes, nodes))
    },
    [],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      setFlowEdges((edges) => applyEdgeChanges(changes, edges))
    },
    [],
  )

  const onConnect = useCallback((connection: Connection) => {
    setFlowEdges((edges) =>
      addEdge(
        {
          ...connection,
          markerEnd: { type: MarkerType.ArrowClosed },
          animated: true,
        },
        edges,
      ),
    )
  }, [])

  const saveWorkflow = async () => {
    const draft = {
      name: workflowName,
      nodes: workflowNodes,
      edges: flowEdges,
      updatedAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem('flowpilot-workflow', JSON.stringify(draft))

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

    setIsRunning(true)
    setNotice('Starting workflow...')

    try {
      const response = await fetch('http://localhost:5000/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          name: workflowName,
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
      setNotice('Demo run unavailable. Please start the backend first.')
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
      setExecutions(Array.isArray(result) ? result : result.executions ?? [])
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
              ×
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
                  Design, connect, and run your workflow.
                </p>
              </div>

              <div className="toolbar">
                <button className="button button-secondary" onClick={addTask}>
                  <Plus size={17} /> Add Task
                </button>
                <button className="button button-secondary" onClick={saveWorkflow}>
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
                    <p className="muted">Select a node to edit its details.</p>
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
                    edges={flowEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={(_, node) => setSelectedNode(Number(node.id))}
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
                  <span>Draft mode</span>
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
                        syncWorkflow(updatedNodes)
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
                        syncWorkflow(updatedNodes)
                      }}
                    />

                    {currentNode.type === 'Task' && (
                      <button
                        className="button button-secondary"
                        style={{
                          width: '100%',
                          marginTop: '16px',
                          color: '#dc2626',
                          borderColor: '#fecaca',
                        }}
                        onClick={deleteTask}
                      >
                        <Trash2 size={17} />
                        Delete Task
                      </button>
                    )}

                    {deletedTask && (
                      <button
                        className="button button-secondary"
                        style={{ width: '100%', marginTop: '10px' }}
                        onClick={undoDeleteTask}
                      >
                        <Undo2 size={17} />
                        Undo Delete: {deletedTask.title}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="muted">Select a node to view its properties.</p>
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
            <h2>Welcome to FlowPilot</h2>
            <p>Build workflows, manage tasks, and review executions.</p>
            <button
              className="button button-primary"
              onClick={() => setActivePage('Workflow Editor')}
            >
              Open Workflow Editor
            </button>
          </section>
        )}

        {activePage === 'Executions' && (
          <section className="simple-panel">
            <div className="panel-heading">
              <h2>Execution History</h2>
              <button
                className="button button-secondary"
                onClick={loadExecutions}
                disabled={isLoadingExecutions}
              >
                {isLoadingExecutions ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {executions.length === 0 ? (
              <p className="muted">No executions loaded yet.</p>
            ) : (
              executions.map((execution, index) => (
                <div className="execution-row" key={execution._id ?? index}>
                  <span>Execution {execution._id ?? index + 1}</span>
                  <span>{execution.status}</span>
                </div>
              ))
            )}
          </section>
        )}

        {activePage === 'Safety Center' && (
          <section className="simple-panel">
            <ShieldCheck size={30} />
            <h2>Safety Center</h2>
            <p>Review your workflow before executing it.</p>
            <ul>
              <li>Verify each task and its description.</li>
              <li>Save your draft before running.</li>
              <li>Check execution results after a run.</li>
            </ul>
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
