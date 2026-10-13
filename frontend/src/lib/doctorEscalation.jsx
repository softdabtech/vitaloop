export function DoctorEscalationDetails({ reason, markers, timingLabel, copy }) {
  return (
    <>
      {!!reason && (
        <p className="text-sm leading-6 text-slate-700">{reason}</p>
      )}
      {!!markers.length && (
        <p className="mt-2 text-sm leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">{copy.doctorEscalationMarkersLabel}:</span> {markers.join(', ')}
        </p>
      )}
      {!!timingLabel && (
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{timingLabel}</p>
      )}
    </>
  )
}
