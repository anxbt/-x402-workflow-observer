"use client"

import { useState, useMemo } from "react"
import { WorkflowList } from "@/components/workflow-list"
import { ExecutionTimeline } from "@/components/execution-timeline"
import { StepInspection } from "@/components/step-inspection"
import { useWorkflows } from "@/hooks/useWorkflows"
import { useWorkflowDetails } from "@/hooks/useWorkflowDetails"
import { useStats } from "@/hooks/useStats"
import { useHealth } from "@/hooks/useHealth"
import { transformWorkflowListItem, transformWorkflowDetails } from "@/lib/transformers"

export default function Dashboard() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  // Fetch data using TanStack Query hooks
  const { data: workflowsData, isLoading: workflowsLoading, error: workflowsError } = useWorkflows()
  const { data: workflowDetailData, isLoading: detailLoading } = useWorkflowDetails(selectedWorkflowId)
  const { data: statsData } = useStats()
  const { data: healthData } = useHealth()

  // Transform API data to UI format
  const workflows = useMemo(() => {
    if (!workflowsData) return []
    return workflowsData.map(transformWorkflowListItem)
  }, [workflowsData])

  const selectedWorkflow = useMemo(() => {
    if (!workflowDetailData) return null
    return transformWorkflowDetails(workflowDetailData)
  }, [workflowDetailData])

  const selectedStep = selectedWorkflow?.steps.find(s => s.id === selectedStepId) || null

  // Auto-select first workflow if none selected
  if (!selectedWorkflowId && workflows.length > 0) {
    setSelectedWorkflowId(workflows[0].id)
  }

  const handleSelectWorkflow = (id: string) => {
    setSelectedWorkflowId(id)
    setSelectedStepId(null)
  }

  // Connection status indicator
  const isConnected = healthData?.status === 'ok'

  return (
    <div className="min-w-[1280px] min-h-screen bg-[#1c1c1e]">
      <header className="border-b border-[#3a3a3d] bg-[#1c1c1e] sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[#d4a855] text-lg font-semibold">◈</span>
            <h1 className="text-[#e5e5e5] text-sm font-semibold tracking-tight">x402 Workflow Debugger</h1>
          </div>
          <div className="flex items-center gap-4">
            {statsData && (
              <>
                <span className="text-xs text-[#8a8a8a]">
                  {statsData.total} workflows ({statsData.running} running)
                </span>
                <div className="w-px h-4 bg-[#3a3a3d]" />
              </>
            )}
            <span className="text-xs text-[#8a8a8a] font-mono">v2.1.0</span>
            <div className="w-px h-4 bg-[#3a3a3d]" />
            <span className={`text-xs ${isConnected ? 'text-[#7d9c6f]' : 'text-[#c45c5c]'}`}>
              {isConnected ? '● Connected' : '● Disconnected'}
            </span>
          </div>
        </div>
      </header>

      <main className="p-6">
        {workflowsError && (
          <div className="mb-6 bg-[#c45c5c]/10 border border-[#c45c5c] px-4 py-3 rounded">
            <p className="text-sm text-[#c45c5c]">
              Failed to load workflows: {workflowsError.message}
            </p>
            <p className="text-xs text-[#8a8a8a] mt-1">
              Make sure the backend is running on http://localhost:3000
            </p>
          </div>
        )}

        {workflowsLoading ? (
          <div className="mb-6 bg-[#252528] border border-[#3a3a3d] px-4 py-8 text-center">
            <p className="text-sm text-[#8a8a8a]">Loading workflows...</p>
          </div>
        ) : (
          <div className="mb-6">
            <WorkflowList
              workflows={workflows}
              selectedWorkflowId={selectedWorkflowId}
              onSelectWorkflow={handleSelectWorkflow}
            />
          </div>
        )}

        {selectedWorkflowId && (
          detailLoading ? (
            <div className="bg-[#252528] border border-[#3a3a3d] px-4 py-8 text-center">
              <p className="text-sm text-[#8a8a8a]">Loading workflow details...</p>
            </div>
          ) : selectedWorkflow ? (
            <div className="grid grid-cols-[1fr_380px] gap-6">
              <ExecutionTimeline
                workflow={selectedWorkflow}
                selectedStepId={selectedStepId}
                onSelectStep={setSelectedStepId}
              />
              <StepInspection step={selectedStep} />
            </div>
          ) : null
        )}
      </main>

      <footer className="border-t border-[#3a3a3d] px-6 py-3 fixed bottom-0 left-0 right-0 bg-[#1c1c1e]">
        <div className="flex items-center justify-between text-xs text-[#8a8a8a]">
          <span>x402 Payment Protocol</span>
          <span className="font-mono">Last sync: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
        </div>
      </footer>
    </div>
  )
}
