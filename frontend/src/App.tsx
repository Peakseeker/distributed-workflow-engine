
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
  Zap,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  GitBranch,
  Settings,
  Flame,
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

const initialWorkflowNodes: WorkflowNode[] = [
  {
    id: 1,
    type: 'Start',
    title: 'Start Workflow',
    description: 'Workflow begins here',
  },
  {
    id: 2,
    type: 'Task',
    title: 'Process Request',
    description: 'Validate and process incoming data',
  },
  {
    id: 3,
    type: 'End',
    title: 'Finish Workflow',
    description: 'Workflow completes successfully',
  },
]

function createFlowNodes(workflowNodes: WorkflowNode[]): Node<FlowNodeData>[] {
  return workflowNodes.map((node, index) => ({
    id: String(node.id),
    type:
      node.type === 'Start'
        ? 'input'
        : node.type === 'End'
          ? 'output'
          : 'default',
    position: { x: 100, y: index * 135 + 40 },
    data: {
      label: `${node.type} NODE\n${node.title}\n${node.description}`,
    },
    style: {
      width: 240,
      minHeight: 70,
      padding: 12,
      borderRadius: 12,
      border: '1px solid #b8dfce',
      background: '#ffffff',
      color: '#202a3b',
      fontSize: 12,
      fontWeight: 500,
      whiteSpace: 'pre-wrap',
      lineHeight: 1.7,
      boxShadow: '0 5px 14px rgba(25, 55, 45, 0.08)',
    },
  }))
}

function createFlowEdges(workflowNodes: WorkflowNode[]): Edge[] {
  return workflowNodes.slice(0, -1).map((node, index) => ({
    id: `e${node.id}-${workflowNodes[index + 1].id}`,
    source: String(node.id),
    target: String(workflowNodes[index + 1].id),
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#0d9b72', strokeWidth: 2 },
  }))
}

function App() {
  const [activePage, setActivePage] = useState('Workflow Editor')
  const [selectedNode, setSelectedNode] = useState(2)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [workflowName, setWorkflowName] = useState('My First Workflow')
  const [isRunning, setIsRunning] = useState(false)
  const [workflowNodes, setWorkflowNodes] =
    useState<WorkflowNode[]>(initialWorkflowNodes)
  const [flowNodes, setFlowNodes] = useState<Node<FlowNodeData>[]>(
    () => createFlowNodes(initialWorkflowNodes),
  )
  const [flowEdges, setFlowEdges] = useState<Edge[]>(
    () => createFlowEdges(initialWorkflowNodes),
  )

  const currentNode = workflowNodes.find(
    (node) => node.id === selectedNode,
  )

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('workflow-editor-draft')

      if (savedDraft) {
        const parsed = JSON.parse(savedDraft)

        if (
          typeof parsed.workflowName === 'string' &&
          Array.isArray(parsed.nodes)
        ) {
          const loadedNodes = parsed.nodes as WorkflowNode[]
          setWorkflowName(parsed.workflowName)
          setWorkflowNodes(loadedNodes)

          if (Array.isArray(parsed.flowNodes)) {
            setFlowNodes(parsed.flowNodes)
          } else {
            setFlowNodes(createFlowNodes(loadedNodes))
          }

          if (Array.isArray(parsed.flowEdges)) {
            setFlowEdges(parsed.flowEdges)
          } else {
            setFlowEdges(createFlowEdges(loadedNodes))
          }

          if (loadedNodes.length > 0) {
            setSelectedNode(loadedNodes[0].id)
          }
        }
      }
    } catch {
      setNotice('Could not load the saved draft.')
    }
  }, [])

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<FlowNodeData>>[]) => {
      setFlowNodes((current) => applyNodeChanges(changes, current))
    },
    [],
  )

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setFlowEdges((current) => applyEdgeChanges(changes, current))
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    setFlowEdges((current) =>
      addEdge(
        {
          ...connection,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#0d9b72', strokeWidth: 2 },
        },
        current,
      ),
    )
  }, [])

  const updateNode = (
    field: 'title' | 'description',
    value: string,
  ) => {
    const updatedNodes = workflowNodes.map((node) =>
      node.id === selectedNode ? { ...node, [field]: value } : node,
    )

    setWorkflowNodes(updatedNodes)

    setFlowNodes((current) =>
      current.map((flowNode) => {
        if (flowNode.id !== String(selectedNode)) return flowNode

        const updatedNode = updatedNodes.find(
          (node) => node.id === selectedNode,
        )

        if (!updatedNode) return flowNode

        return {
          ...flowNode,
          data: {
            label: `${updatedNode.type} NODE\n${updatedNode.title}\n${updatedNode.description}`,
          },
        }
      }),
    )
  }

  const addTask = () => {
    const id = Math.max(0, ...workflowNodes.map((node) => node.id)) + 1

    const newTask: WorkflowNode = {
      id,
      type: 'Task',
      title: `New Task ${id}`,
      description: 'Describe what this task should do',
    }

    const updatedNodes = [...workflowNodes]
    const endIndex = updatedNodes.findIndex(
      (node) => node.type === 'End',
    )

    updatedNodes.splice(
      endIndex < 0 ? updatedNodes.length : endIndex,
      0,
      newTask,
    )

    setWorkflowNodes(updatedNodes)

    setFlowNodes((current) => [
      ...current,
      {
        id: String(id),
        type: 'default',
        position: { x: 100, y: current.length * 135 + 40 },
        data: {
          label: `Task NODE\n${newTask.title}\n${newTask.description}`,
        },
        style: {
          width: 240,
          minHeight: 70,
          padding: 12,
          borderRadius: 12,
          border: '1px solid #b8dfce',
          background: '#ffffff',
          color: '#202a3b',
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.7,
        },
      },
    ])

    setFlowEdges(createFlowEdges(updatedNodes))
    setSelectedNode(id)
    setNotice('New task added. You can drag it on the canvas.')
  }

  const saveWorkflow = () => {
    try {
      localStorage.setItem(
        'workflow-editor-draft',
        JSON.stringify({
          workflowName,
          nodes: workflowNodes,
          flowNodes,
          flowEdges,
        }),
      )
      setNotice('Workflow draft saved in this browser.')
    } catch {
      setNotice('Could not save the draft in this browser.')
    }
  }

  const runWorkflow = () => {
    if (workflowNodes.length < 2) {
      setNotice('Add workflow steps before running.')
      return
    }

    setIsRunning(true)
    setNotice(
      `Workflow execution completed: ${workflowNodes
        .map((node) => node.title)
        .join(' → ')}`,
    )

    window.setTimeout(() => setIsRunning(false), 1800)
  }

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Workflow Editor', icon: Workflow },
    { label: 'Executions', icon: Activity },
    { label: 'Safety Center', icon: ShieldCheck },
  ]

  const filteredNodes = workflowNodes.filter((node) =>
    `${node.title} ${node.description}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  const visibleFlowNodes = flowNodes.filter((flowNode) =>
    filteredNodes.some((node) => String(node.id) === flowNode.id),
  )

  const visibleFlowEdges = flowEdges.filter(
    (edge) =>
      visibleFlowNodes.some((node) => node.id === edge.source) &&
      visibleFlowNodes.some((node) => node.id === edge.target),
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <GitBranch size={23} />
          </div>
          <div>
            <strong>FlowPilot</strong>
            <span>WORKFLOW ENGINE</span>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch">
          <div className="workspace-avatar">S</div>
          <div className="workspace-text">
            <strong>Shreya's Workspace</strong>
            <span>Personal workspace</span>
          </div>
          <MoreHorizontal size={18} />
        </div>

        <div className="nav-label">MENU</div>
        <nav className="navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${
                activePage === label ? 'active' : ''
              }`}
              onClick={() => {
                setActivePage(label)
                setNotice(
                  label === 'Safety Center'
                    ? 'Safety Center selected.'
                    : `${label} selected.`,
                )
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === 'Executions' && (
                <span className="nav-count">0</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="streak-card">
            <div className="streak-icon">
              <Flame size={21} />
            </div>
            <div className="streak-copy">
              <span>WORK STREAK</span>
              <strong>1 day 🔥</strong>
              <small>Keep the momentum going!</small>
            </div>
          </div>

          <button
            className="nav-item settings-item"
            onClick={() => setNotice('Settings will be available later.')}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="profile">
            <div className="profile-avatar">S</div>
            <div>
              <strong>Shreya</strong>
              <span>Project Owner</span>
            </div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="top-actions">
            <label className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
              />
              <kbd>Ctrl K</kbd>
            </label>

            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => setNotice('You are all caught up!')}
            >
              <Bell size={19} />
              <span className="notification-dot" />
            </button>

            <div className="top-divider" />
            <div className="top-avatar">S</div>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="live-dot" /> WORKFLOW WORKSPACE
              </div>
              <h1>{activePage}</h1>
              <p>Design, manage and monitor your automated workflows.</p>
            </div>

            <div className="header-buttons">
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
                <Play size={16} fill="currentColor" />
                {isRunning ? 'Running...' : 'Run workflow'}
              </button>
            </div>
          </div>

          {notice && (
            <div className="notice" role="status">
              <CheckCircle2 size={17} />
              <span>{notice}</span>
              <button
                onClick={() => setNotice('')}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-top">
                <span>Total workflows</span>
                <div className="stat-icon purple">
                  <Workflow size={19} />
                </div>
              </div>
              <strong>01</strong>
              <small>
                <span className="positive">↑ 1</span> created in your workspace
              </small>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Total tasks</span>
                <div className="stat-icon blue">
                  <Zap size={19} />
                </div>
              </div>
              <strong>{workflowNodes.length}</strong>
              <small>Tasks and workflow steps</small>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Successful runs</span>
                <div className="stat-icon green">
                  <CheckCircle2 size={19} />
                </div>
              </div>
              <strong>00</strong>
              <small>Backend execution not connected</small>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Last activity</span>
                <div className="stat-icon orange">
                  <Clock3 size={19} />
                </div>
              </div>
              <strong>Just now</strong>
              <small>Your workspace is ready</small>
            </div>
          </section>

          <section className="editor-card">
            <div className="editor-toolbar">
              <div className="editor-title">
                <div className="mini-workflow-icon">
                  <Workflow size={19} />
                </div>
                <div>
                  <input
                    className="workflow-name"
                    value={workflowName}
                    onChange={(event) => setWorkflowName(event.target.value)}
                    aria-label="Workflow name"
                  />
                  <span>
                    <span className="draft-dot" /> Draft changes are saved
                    when you click Save
                  </span>
                </div>
              </div>

              <div className="editor-toolbar-actions">
                <span className="version-label">Draft v1</span>
                <button
                  className="button button-secondary button-small"
                  onClick={addTask}
                >
                  <Plus size={16} /> Add task
                </button>
              </div>
            </div>

            <div className="editor-layout">
              <div className="canvas-area">
                <div className="canvas-meta">
                  <span>
                    <span className="canvas-dot" /> CANVAS
                  </span>
                  <span>{flowNodes.length} NODES</span>
                </div>

                <div
                  className="canvas-grid"
                  style={{ height: 520, minHeight: 520, padding: 0 }}
                >
                  {visibleFlowNodes.length === 0 ? (
                    <div className="empty-search">
                      No workflow nodes match your search.
                    </div>
                  ) : (
                    <ReactFlow<Node<FlowNodeData>, Edge>
                      nodes={visibleFlowNodes}
                      edges={visibleFlowEdges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      onNodeClick={(_, node) =>
                        setSelectedNode(Number(node.id))
                      }
                      fitView
                      fitViewOptions={{ padding: 0.2 }}
                      nodesDraggable
                      nodesConnectable
                      elementsSelectable
                      deleteKeyCode={['Backspace', 'Delete']}
                    >
                      <Background color="#d5e5dc" gap={20} size={1} />
                      <Controls />
                      <MiniMap
                        nodeStrokeWidth={3}
                        zoomable
                        pannable
                      />
                    </ReactFlow>
                  )}
                </div>

                <div className="canvas-footer">
                  <span>
                    <span className="status-dot" /> Drag nodes to arrange
                    your workflow
                  </span>
                  <span>React Flow canvas</span>
                </div>
              </div>

              <aside className="properties-panel">
                <div className="panel-heading">
                  <div>
                    <strong>Node properties</strong>
                    <span>Configure selected step</span>
                  </div>
                  <Settings size={18} />
                </div>

                {currentNode ? (
                  <>
                    <div className="selected-node-badge">
                      <div
                        className={`property-node-icon ${currentNode.type.toLowerCase()}`}
                      >
                        {currentNode.type === 'Start' ? (
                          <Play size={17} />
                        ) : currentNode.type === 'End' ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          <Zap size={17} />
                        )}
                      </div>
                      <div>
                        <strong>{currentNode.type} node</strong>
                        <span>ID: node-{currentNode.id}</span>
                      </div>
                    </div>

                    <label className="field-label" htmlFor="node-title">
                      Node name
                    </label>
                    <input
                      id="node-title"
                      className="property-input"
                      value={currentNode.title}
                      onChange={(event) =>
                        updateNode('title', event.target.value)
                      }
                    />

                    <label
                      className="field-label"
                      htmlFor="node-description"
                    >
                      Description
                    </label>
                    <textarea
                      id="node-description"
                      className="property-input property-textarea"
                      rows={4}
                      value={currentNode.description}
                      onChange={(event) =>
                        updateNode('description', event.target.value)
                      }
                    />

                    <div className="property-divider" />

                    <div className="property-info">
                      <span>Node type</span>
                      <strong>{currentNode.type}</strong>
                    </div>

                    <div className="property-info">
                      <span>Execution status</span>
                      <span className="status-pill">
                        <span /> Not run
                      </span>
                    </div>

                    <div className="property-hint">
                      <ShieldCheck size={17} />
                      <span>
                        Click Save to keep your workflow and node positions
                        in this browser.
                      </span>
                    </div>
                  </>
                ) : (
                  <p>Select a node to see its properties.</p>
                )}
              </aside>
            </div>
          </section>

          <footer className="page-footer">
            <span>
              FlowPilot <span>•</span> Workflow Orchestration
            </span>
            <span>
              Built for clarity and control <ShieldCheck size={14} />
            </span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App
