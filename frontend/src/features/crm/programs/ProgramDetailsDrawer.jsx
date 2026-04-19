import { createPortal } from 'react-dom'

export default function ProgramDetailsDrawer({ program, onClose }) {
  if (!program) return null

  const content = (
    <div className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm">
      <div className="fixed right-0 top-0 bottom-0 h-full w-full max-w-[420px] overflow-y-auto border-l border-slate-600/60 bg-[#111827] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-lg font-semibold text-slate-100">Program Details</h3>
          <button onClick={onClose} className="vtl-button-secondary min-h-[34px] rounded-lg px-3 py-1.5 text-xs">Close</button>
        </div>
        <div className="space-y-2 text-sm leading-relaxed text-slate-300">
          <p><strong>Name:</strong> {program.name || '-'}</p>
          <p><strong>Category:</strong> {program.category || '-'}</p>
          <p><strong>Status:</strong> {program.status || '-'}</p>
          <p><strong>Duration:</strong> {program.duration_days || '-'} days</p>
          <p><strong>Description:</strong> {program.description || 'No description'}</p>
          <p><strong>Created:</strong> {program.created_at ? new Date(program.created_at).toLocaleString() : '-'}</p>
          <div>
            <strong>Checkpoint intervals:</strong>
            <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-950/55 p-3 text-xs text-slate-200">{JSON.stringify(program.checkpoint_intervals || [], null, 2)}</pre>
          </div>
          <div>
            <strong>Template protocol:</strong>
            <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-950/55 p-3 text-xs text-slate-200">{JSON.stringify(program.template_protocol || {}, null, 2)}</pre>
          </div>
          <div>
            <strong>Biomarker targets:</strong>
            <pre className="mt-1 overflow-x-auto rounded-xl bg-slate-950/55 p-3 text-xs text-slate-200">{JSON.stringify(program.biomarker_targets || {}, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
