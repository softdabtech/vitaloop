import { useEffect } from 'react'

export function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view')
            observer.unobserve(e.target)
          }
        }),
      { threshold: 0.12 }
    )

    const els = document.querySelectorAll('.reveal')
    els.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])
}
