import '@xyflow/react/dist/style.css';
import { useEffect, useState } from 'react'
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
  ArrowRight,
} from 'lucide-react'
import './App.css'

type NodeType = 'Start' | 'Task' | 'End'

type WorkflowNode = {
  id: number
  type: NodeType
  title: string
  description: string
}

function App() {
  const [activePage, setActivePage] = useState('Workflow Editor')
  const [selectedNode, setSelectedNode] = useState(2)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [workflowName, setWorkflowName] = useState('My First Workflow')
  const [isRunning, setIsRunning] = useState(false)
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: 1, type: 'Start', title: 'Start Workflow', description: 'Workflow begins here' },
    { id: 2, type: 'Task', title: 'Process Request', description: 'Validate and process incoming data' },
    { id: 3, type: 'End', title: 'Finish Workflow', description: 'Workflow completes successfully' },
  ])

  const currentNode = nodes.find((node) => node.id === selectedNode)
  useEffect(() => {
  try {
    const savedDraft = localStorage.getItem('workflow-editor-draft')

    if (savedDraft) {
      const parsedDraft = JSON.parse(savedDraft)

      if (
        typeof parsedDraft.workflowName === 'string' &&
        Array.isArray(parsedDraft.nodes)
      ) {
        setWorkflowName(parsedDraft.workflowName)
        setNodes(parsedDraft.nodes)
      }
    }
  } catch {
    console.error('Could not load the saved workflow.')
  }
}, [])

  const updateNode = (field: 'title' | 'description', value: string) => {
    setNodes((previous) =>
      previous.map((node) =>
        node.id === selectedNode ? { ...node, [field]: value } : node,
      ),
    )
  }

  const addTask = () => {
    const id = Math.max(0, ...nodes.map((node) => node.id)) + 1
    const newTask: WorkflowNode = {
      id,
      type: 'Task',
      title: `New Task ${id}`,
      description: 'Describe what this task should do',
    }
    const endIndex = nodes.findIndex((node) => node.type === 'End')
    const updated = [...nodes]
    updated.splice(endIndex < 0 ? updated.length : endIndex, 0, newTask)
    setNodes(updated)
    setSelectedNode(id)
    setNotice('New task added to the workflow.')
  }

  const saveWorkflow = () => {
    try {
      localStorage.setItem(
        'workflow-editor-draft',
        JSON.stringify({ workflowName, nodes }),
      )
      setNotice('Workflow draft saved in this browser.')
    } catch {
      setNotice('Could not save the draft in this browser.')
    }
  }

  const runWorkflow = () => {
    setIsRunning(true)
    setNotice('Demo run started. Backend execution is not connected yet.')
    window.setTimeout(() => setIsRunning(false), 1800)
  }

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Workflow Editor', icon: Workflow },
    { label: 'Executions', icon: Activity },
    { label: 'Safety Center', icon: ShieldCheck },
  ]

  const filteredNodes = nodes.filter((node) =>
    `${node.title} ${node.description}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><GitBranch size={23} /></div>
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
              className={`nav-item ${activePage === label ? 'active' : ''}`}
              onClick={() => {
                setActivePage(label)
                setNotice(label === 'Safety Center' ? 'Safety Center selected. Safety checks will be added in a later task.' : `${label} selected.`)
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === 'Executions' && <span className="nav-count">0</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="streak-card">
            <div className="streak-icon"><Flame size={21} /></div>
            <div className="streak-copy">
              <span>WORK STREAK</span>
              <strong>1 day <span>🔥</span></strong>
              <small>Keep the momentum going!</small>
            </div>
          </div>
          <button className="nav-item settings-item" onClick={() => setNotice('Settings will be available in a later task.')}>
            <Settings size={19} /><span>Settings</span>
          </button>
          <div className="profile">
            <div className="profile-avatar">S</div>
            <div><strong>Shreya</strong><span>Project Owner</span></div>
            <MoreHorizontal size={19} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span><span className="crumb-slash">/</span>
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
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button" aria-label="Notifications" onClick={() => setNotice('You are all caught up!')}>
              <Bell size={19} /><span className="notification-dot" />
            </button>
            <div className="top-divider" />
            <div className="top-avatar">S</div>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot" /> WORKFLOW WORKSPACE</div>
              <h1>{activePage === 'Workflow Editor' ? 'Workflow Editor' : activePage}</h1>
              <p>Design, manage and monitor your automated workflows.</p>
            </div>
            <div className="header-buttons">
              <button className="button button-secondary" onClick={saveWorkflow}>
                <Save size={17} /> Save
              </button>
              <button className="button button-primary" onClick={runWorkflow} disabled={isRunning}>
                <Play size={16} fill="currentColor" /> {isRunning ? 'Running...' : 'Run workflow'}
              </button>
            </div>
          </div>

          {notice && (
            <div className="notice" role="status">
              <CheckCircle2 size={17} /><span>{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button>
            </div>
          )}

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-top"><span>Total workflows</span><div className="stat-icon purple"><Workflow size={19} /></div></div>
              <strong>01</strong><small><span className="positive">↑ 1</span> created in your workspace</small>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Total tasks</span><div className="stat-icon blue"><Zap size={19} /></div></div>
              <strong>{nodes.length}</strong><small>Tasks and workflow steps</small>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Successful runs</span><div className="stat-icon green"><CheckCircle2 size={19} /></div></div>
              <strong>00</strong><small>Backend execution not connected</small>
            </div>
            <div className="stat-card">
              <div className="stat-top"><span>Last activity</span><div className="stat-icon orange"><Clock3 size={19} /></div></div>
              <strong>Just now</strong><small>Your workspace is ready</small>
            </div>
          </section>

          <section className="editor-card">
            <div className="editor-toolbar">
              <div className="editor-title">
                <div className="mini-workflow-icon"><Workflow size={19} /></div>
                <div>
                  <input
                    className="workflow-name"
                    value={workflowName}
                    onChange={(event) => setWorkflowName(event.target.value)}
                    aria-label="Workflow name"
                  />
                  <span><span className="draft-dot" /> Unsaved changes may be saved locally</span>
                </div>
              </div>
              <div className="editor-toolbar-actions">
                <span className="version-label">Draft v1</span>
                <button className="button button-secondary button-small" onClick={addTask}><Plus size={16} /> Add task</button>
              </div>
            </div>

            <div className="editor-layout">
              <div className="canvas-area">
                <div className="canvas-meta">
                  <span><span className="canvas-dot" /> CANVAS</span>
                  <span>{nodes.length} NODES</span>
                </div>
                <div className="canvas-grid">
                  {filteredNodes.length === 0 ? (
                    <div className="empty-search">No workflow nodes match your search.</div>
                  ) : (
                    <div className="workflow-flow">
                      {filteredNodes.map((node, index) => (
                        <div className="flow-item" key={node.id}>
                          <button
                            className={`workflow-node ${node.type.toLowerCase()} ${selectedNode === node.id ? 'selected' : ''}`}
                            onClick={() => setSelectedNode(node.id)}
                          >
                            <div className="node-symbol">
                              {node.type === 'Start' ? <Play size={17} /> : node.type === 'End' ? <CheckCircle2 size={18} /> : <Zap size={18} />}
                            </div>
                            <div className="node-text">
                              <span>{node.type.toUpperCase()} NODE</span>
                              <strong>{node.title}</strong>
                              <small>{node.description}</small>
                            </div>
                            <MoreHorizontal size={18} className="node-more" />
                          </button>
                          {index < filteredNodes.length - 1 && (
                            <div className="connector"><span /><ArrowRight size={16} /></div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="canvas-footer">
                  <span><span className="status-dot" /> All changes are local to this demo</span>
                  <span>100% zoom</span>
                </div>
              </div>

              <aside className="properties-panel">
                <div className="panel-heading">
                  <div><strong>Node properties</strong><span>Configure selected step</span></div>
                  <Settings size={18} />
                </div>
                {currentNode ? (
                  <>
                    <div className="selected-node-badge">
                      <div className={`property-node-icon ${currentNode.type.toLowerCase()}`}>
                        {currentNode.type === 'Start' ? <Play size={17} /> : currentNode.type === 'End' ? <CheckCircle2 size={17} /> : <Zap size={17} />}
                      </div>
                      <div><strong>{currentNode.type} node</strong><span>ID: node-{currentNode.id}</span></div>
                    </div>
                    <label className="field-label" htmlFor="node-title">Node name</label>
                    <input id="node-title" className="property-input" value={currentNode.title} onChange={(event) => updateNode('title', event.target.value)} />
                    <label className="field-label" htmlFor="node-description">Description</label>
                    <textarea id="node-description" className="property-input property-textarea" rows={4} value={currentNode.description} onChange={(event) => updateNode('description', event.target.value)} />
                    <div className="property-divider" />
                    <div className="property-info"><span>Node type</span><strong>{currentNode.type}</strong></div>
                    <div className="property-info"><span>Execution status</span><span className="status-pill"><span /> Not run</span></div>
                    <div className="property-hint"><ShieldCheck size={17} /><span>Your edits are kept in the current browser session until you save.</span></div>
                  </>
                ) : <p>Select a node to see its properties.</p>}
              </aside>
            </div>
          </section>

          <footer className="page-footer">
            <span>FlowPilot <span>•</span> Workflow Orchestration</span>
            <span>Built for clarity and control <ShieldCheck size={14} /></span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App