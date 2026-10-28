function LinkedInIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.5 8.25H3.25V21H6.5V8.25ZM4.88 3A1.88 1.88 0 1 0 4.87 6.75 1.88 1.88 0 0 0 4.88 3ZM21 13.69c0-3.84-2.05-5.63-4.79-5.63a4.14 4.14 0 0 0-3.73 2.05h-.05V8.25H9.31V21h3.25v-6.31c0-1.67.32-3.28 2.38-3.28 2.03 0 2.06 1.9 2.06 3.39V21h3.25l.75-7.31Z" />
    </svg>
  )
}

const CATEGORY_LABELS = {
  engineering: 'Engineering',
  health: 'Health & Nutrition',
}

export default function TeamMemberCard({ member }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      {member.image ? (
        <div className="h-52 overflow-hidden bg-slate-100 sm:h-48 xl:h-52">
          <img src={member.image} alt={`${member.name}, ${member.role} at VITALOOP`} className="h-full w-full object-cover object-top" loading="lazy" width="1000" height="1000" />
        </div>
      ) : (
        <div className="flex h-36 items-end bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 sm:h-32 xl:h-36">
          <span className="rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800">
            {CATEGORY_LABELS[member.category]}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {member.name ? (
          <>
            <h4 className="text-xl font-bold tracking-[-0.02em] text-slate-950">{member.name}</h4>
            <p className="mt-1 text-sm font-semibold text-emerald-700">{member.role}</p>
          </>
        ) : (
          <h4 className="text-base font-bold text-emerald-800">{member.role}</h4>
        )}
        <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{member.bio}</p>
        {member.linkedin && (
          <a href={member.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on LinkedIn`} className="mt-5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
            <LinkedInIcon />
          </a>
        )}
      </div>
    </article>
  )
}
