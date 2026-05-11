import { useEffect, useState } from 'react'

const TESTIMONIALS = [
  {
    quote: 'I stopped guessing. VITALOOP gave me a clear sequence and my energy stabilized in six weeks.',
    author: 'Nora, 34',
    role: 'Product lead, Berlin',
    result: 'Ferritin: 14 to 68 ng/mL in 12 weeks',
  },
  {
    quote: 'After two uploads, the timeline made my improvements obvious and kept me consistent.',
    author: 'Mila, 29',
    role: 'Designer, Warsaw',
    result: 'Vitamin D: 19 to 41 ng/mL in 10 weeks',
  },
  {
    quote: 'The weekly check-ins made me actually follow the plan. My ferritin trend finally moved in the right direction.',
    author: 'Alex, 41',
    role: 'Founder, London',
    result: 'CRP: 5.2 to 1.8 mg/L in 8 weeks',
  },
  {
    quote: 'The dosage precision helped me stop over-supplementing and still improved my lab markers.',
    author: 'Denis, 37',
    role: 'Engineer, Prague',
    result: 'B12 normalized in 6 weeks with structured protocol',
  },
  {
    quote: 'As a clinician, I value how quickly I can see risk patterns and adherence context in one place.',
    author: 'Dr. Sam R.',
    role: 'Functional medicine practitioner',
    result: 'Client review prep: 45 min to 12 min',
  },
  {
    quote: 'VITALOOP turned my raw PDF into a week-by-week plan I can actually execute.',
    author: 'Ibrahim, 45',
    role: 'Operator, Dubai',
    result: 'Energy score up and inflammation markers down over 9 weeks',
  },
]

export function TestimonialsCarousel() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % TESTIMONIALS.length)
    }, 7000)

    return () => clearInterval(timer)
  }, [])

  const visible = [0, 1, 2].map((offset) => TESTIMONIALS[(active + offset) % TESTIMONIALS.length])

  return (
    <section id="testimonials" className="relative px-4 py-16 sm:px-6 md:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center md:mb-12">
          <h2 className="mb-3 text-3xl font-bold text-slate-900 md:text-4xl">Real results</h2>
          <p className="text-base text-slate-600 md:text-lg">Six recent outcomes from users running real protocol cycles</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <article key={`${item.author}-${item.result}`} className="rounded-2xl border border-slate-200 bg-white p-6 md:p-7">
              <div className="mb-3 text-3xl leading-none text-emerald-400">"</div>
              <p className="text-base leading-relaxed text-slate-900">{item.quote}</p>
              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="font-semibold text-slate-900">{item.author}</div>
                <div className="mt-0.5 text-sm text-slate-600">{item.role}</div>
                <div className="mt-2 text-sm font-medium text-emerald-700">{item.result}</div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`inline-icon h-2 w-2 rounded-full p-0 transition-all ${i === active ? 'bg-emerald-500' : 'bg-slate-300 hover:bg-slate-400'}`}
              aria-label={`Show testimonial group starting from ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
