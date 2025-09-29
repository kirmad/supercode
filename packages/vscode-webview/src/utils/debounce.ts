/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): T & { cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let result: any

  const debounced = function (this: any, ...args: Parameters<T>) {
    const later = () => {
      timeout = null
      if (!immediate) result = func.apply(this, args)
    }

    const callNow = immediate && !timeout
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)

    if (callNow) result = func.apply(this, args)
    return result
  } as T & { cancel: () => void }

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return debounced
}