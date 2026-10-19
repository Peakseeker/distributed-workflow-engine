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

const API_URL = 'http://localhost:5000/api'

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

function createFlowNodes(
  workflowNodes: WorkflowNode[],
): Node<FlowNodeData>[] {
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
  const [workflowId, setWorkflowId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [executions, setExecutions] = useState<Execution[]>([])
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false)

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

      if (!savedDraft) return

      const parsed = JSON.parse(savedDraft)

      if (
        typeof parsed.workflowName === 'string' &&
        Array.isArray(parsed.nodes)
      ) {
        const loadedNodes = parsed.nodes as WorkflowNode[]

        setWorkflowName(parsed.workflowName)
        setWorkflowNodes(loadedNodes)
        setFlowNodes(
          Array.isArray(parsed.flowNodes)
            ? parsed.flowNodes
            : createFlowNodes(loadedNodes),
        )
        setFlowEdges(
          Array.isArray(parsed.flowEdges)
            ? parsed.flowEdges
            : createFlowEdges(loadedNodes),
        )

        if (loadedNodes.length > 0) {
          setSelectedNode(loadedNodes[0].id)
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
    setFlowNodes(createFlowNodes(updatedNodes))
    setFlowEdges(createFlowEdges(updatedNodes))
    setSelectedNode(id)
    setNotice('New task added successfully.')
  }

  const saveWorkflow = async () => {
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
    } catch {
      setNotice('Could not save the local browser draft.')
      return
    }

    try {
      const workflowPayload = {
        name: workflowName.trim() || 'Untitled Workflow',
        description: 'Workflow created from the FlowPilot editor',
        nodes: workflowNodes,
        edges: flowEdges,
        status: 'draft',
      }

      const endpoint = workflowId
        ? `${API_URL}/workflows/${workflowId}`
        : `${API_URL}/workflows`

      const response = await fetch(endpoint, {
        method: workflowId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflowPayload),
      })

      const responseData = await response.json().catch(() => ({}))

      if (!response.ok) {
        setNotice(
          `Browser draft saved, but backend save failed (${response.status}).`,
        )
        return
      }

      const savedWorkflow = responseData.workflow ?? responseData
      const savedId = savedWorkflow._id ?? savedWorkflow.id

      if (typeof savedId === 'string') {
        setWorkflowId(savedId)
        setNotice('Workflow saved to backend and browser.')
      } else {
        setNotice('Backend responded successfully. Browser draft saved.')
      }
    } catch {
      setNotice(
        'Browser draft saved, but backend is unavailable. Check the backend server.',
      )
    }
  }

  const runWorkflow = async () => {
    if (workflowNodes.length < 2) {
      setNotice('Add workflow steps before running.')
      return
    }

    if (!workflowId) {
      setNotice('Please save the workflow before running it.')
      return
    }

    setIsRunning(true)
    setNotice('Starting workflow execution...')

    try {
      const response = await fetch(
        `${API_URL}/workflows/${workflowId}/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Workflow execution failed.')
      }

      const execution = data.execution

      setNotice(
        execution?.steps
          ? `${data.message}: ${execution.steps
              .map((step: { name: string }) => step.name)
              .join(' → ')}`
          : data.message || 'Workflow execution started.',
      )

      await loadExecutions()
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not execute the workflow.',
      )
    } finally {
      setIsRunning(false)
    }
  }

  const loadExecutions = async () => {
    if (!workflowId) {
      setNotice('Save the workflow first to view its execution history.')
      return
    }

    setIsLoadingExecutions(true)

    try {
      const response = await fetch(
        `${API_URL}/workflows/${workflowId}/executions`,
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load execution history.')
      }

      setExecutions(data.executions ?? [])
      setNotice(
        `Loaded ${data.executions?.length ?? 0} execution record(s).`,
      )
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not load execution history.',
      )
    } finally {
      setIsLoadingExecutions(false)
    }
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
            <strong>My Workspace</strong>
            <span>Personal workspace</span>
          </div>
          <MoreHorizontal size={18} />
        </div>

        <div className="nav-label">MENU</div>

        <nav className="navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activePage === label ? 'active' : ''}`}
              onClick={() => {
                setActivePage(label)
                setNotice('')

                if (label === 'Executions') {
                  void loadExecutions()
                }
              }}
            >
              <Icon size={19} />
              <span>{label}</span>

              {label === 'Executions' && (
                <span className="nav-count">{executions.length}</span>
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
              <strong>Work Streak</strong>
              <span>Keep building every day!</span>
            </div>
          </div>

          <button
            className="settings-item"
            onClick={() => setNotice('Settings selected.')}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <div className="profile">
            <div className="profile-avatar">S</div>
            <div className="profile-copy">
              <strong>My Account</strong>
              <span>Personal workspace</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace <span>/</span> {activePage}
          </div>

          <div className="top-actions">
            <label className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workflow nodes..."
              />
            </label>

            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => setNotice('You are all caught up.')}
            >
              <Bell size={19} />
            </button>

            <div className="top-divider" />
            <div className="top-avatar">S</div>
          </div>
        </header>

        <section className="page-content">
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                onClick={() => setNotice('')}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}

          {activePage === 'Executions' ? (
            <section className="editor-card" style={{ padding: '24px' }}>
              <div className="welcome-row">
                <div>
                  <div className="eyebrow">
                    <span className="live-dot" />
                    EXECUTION HISTORY
                  </div>

                  <h1>Workflow Executions</h1>
                  <p>View the execution records for your saved workflow.</p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => void loadExecutions()}
                  disabled={isLoadingExecutions}
                >
                  {isLoadingExecutions ? 'Loading...' : 'Refresh History'}
                </button>
              </div>

              {!workflowId ? (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <h3>Save your workflow first</h3>
                  <p>
                    Save the workflow from the editor to view its execution
                    history.
                  </p>
                  <button
                    className="button button-primary"
                    onClick={() => setActivePage('Workflow Editor')}
                  >
                    Open Workflow Editor
                  </button>
                </div>
              ) : executions.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center' }}>
                  <h3>No executions found</h3>
                  <p>Run a saved workflow to see its history here.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: '24px' }}>
                  <table
                    style={{ width: '100%', borderCollapse: 'collapse' }}
                  >
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '12px' }}>
                          Execution ID
                        </th>
                        <th style={{ textAlign: 'left', padding: '12px' }}>
                          Status
                        </th>
                        <th style={{ textAlign: 'left', padding: '12px' }}>
                          Started At
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {executions.map((execution) => (
                        <tr key={execution._id}>
                          <td style={{ padding: '12px' }}>
                            {execution._id}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {execution.status}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {execution.startedAt
                              ? new Date(
                                  execution.startedAt,
                                ).toLocaleString()
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : activePage === 'Workflow Editor' ? (
            <>
              <div className="welcome-row">
                <div>
                  <div className="eyebrow">
                    <span className="live-dot" />
                    WORKFLOW WORKSPACE
                  </div>
                  <h1>Workflow Editor</h1>
                  <p>Design, manage and monitor your workflows.</p>
                </div>

                <div className="header-buttons">
                  <button
                    className="button button-secondary"
                    onClick={addTask}
                  >
                    <Plus size={17} />
                    Add Task
                  </button>

                  <button
                    className="button button-secondary"
                    onClick={() => void saveWorkflow()}
                  >
                    <Save size={17} />
                    Save
                  </button>

                  <button
                    className="button button-primary"
                    onClick={() => void runWorkflow()}
                    disabled={isRunning}
                  >
                    <Play size={16} />
                    {isRunning ? 'Running...' : 'Run Workflow'}
                  </button>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Total Nodes</span>
                    <div className="stat-icon">
                      <Workflow size={19} />
                    </div>
                  </div>
                  <strong>{workflowNodes.length}</strong>
                  <small>Steps in this workflow</small>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Connections</span>
                    <div className="stat-icon">
                      <GitBranch size={19} />
                    </div>
                  </div>
                  <strong>{flowEdges.length}</strong>
                  <small>Workflow connections</small>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span>Workflow Status</span>
                    <div className="stat-icon">
                      <ShieldCheck size={19} />
                    </div>
                  </div>
                  <strong>Draft</strong>
                  <small>Ready for editing</small>
                </div>
              </div>

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
                        onChange={(event) =>
                          setWorkflowName(event.target.value)
                        }
                        aria-label="Workflow name"
                      />
                      <div className="version-label">Workflow draft</div>
                    </div>
                  </div>

                  <div className="editor-toolbar-actions">
                    <span className="status-pill">● Draft</span>
                  </div>
                </div>

                <div className="editor-layout">
                  <div className="canvas-area">
                    <div className="canvas-meta">
                      <span>WORKFLOW CANVAS</span>
                      <span>{visibleFlowNodes.length} nodes</span>
                    </div>

                    <div className="canvas-grid">
                      {visibleFlowNodes.length > 0 ? (
                        <ReactFlow
                          nodes={visibleFlowNodes}
                          edges={visibleFlowEdges}
                          onNodesChange={onNodesChange}
                          onEdgesChange={onEdgesChange}
                          onConnect={onConnect}
                          onNodeClick={(_, node) =>
                            setSelectedNode(Number(node.id))
                          }
                          fitView
                          fitViewOptions={{ padding: 0.25 }}
                        >
                          <Background />
                          <Controls />
                          <MiniMap />
                        </ReactFlow>
                      ) : (
                        <div className="empty-search">
                          No nodes match your search.
                        </div>
                      )}
                    </div>

                    <div className="canvas-footer">
                      Drag nodes to reposition them. Connect node handles to
                      create workflow paths.
                    </div>
                  </div>

                  <aside className="properties-panel">
                    <div className="panel-heading">
                      <div>
                        <strong>Node Properties</strong>
                        <span>Edit the selected step</span>
                      </div>
                    </div>

                    {currentNode ? (
                      <>
                        <div className="selected-node-badge">
                          <div className="property-node-icon">
                            <Workflow size={20} />
                          </div>
                          <div>
                            <strong>{currentNode.type} Node</strong>
                            <span>ID: {currentNode.id}</span>
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
                          className="property-textarea"
                          value={currentNode.description}
                          onChange={(event) =>
                            updateNode('description', event.target.value)
                          }
                          rows={4}
                        />

                        <div className="property-divider" />

                        <div className="property-info">
                          <span>Node type</span>
                          <strong>{currentNode.type}</strong>
                        </div>

                        <div className="property-info">
                          <span>Node status</span>
                          <strong className="status-pill">Draft</strong>
                        </div>

                        <p className="property-hint">
                          Changes are reflected in the canvas. Click Save to
                          store your workflow.
                        </p>
                      </>
                    ) : (
                      <p>
                        Select a node on the canvas to edit its properties.
                      </p>
                    )}
                  </aside>
                </div>
              </section>
            </>
          ) : (
            <section className="editor-card" style={{ padding: '24px' }}>
              <div className="eyebrow">
                <span className="live-dot" />
                WORKSPACE
              </div>
              <h1>{activePage}</h1>

              {activePage === 'Dashboard' ? (
                <p>
                  Welcome to FlowPilot. Open Workflow Editor to design your
                  workflow or Executions to review its history.
                </p>
              ) : (
                <p>
                  Your safety tools and workflow safeguards will be available
                  here.
                </p>
              )}

              <button
                className="button button-primary"
                onClick={() => setActivePage('Workflow Editor')}
              >
                <Workflow size={17} />
                Open Workflow Editor
              </button>
            </section>
          )}

          <footer className="page-footer">
            <span>FlowPilot · Workflow Engine</span>
            <span>Draft changes are stored locally when you save.</span>
          </footer>
        </section>
      </main>
    </div>
  )
}

export default App