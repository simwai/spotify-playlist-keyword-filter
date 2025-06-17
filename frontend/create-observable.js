/**
 * Creates an observable proxy for an object.
 * @param {object} obj - The plain object to make observable.
 * @param {function} callback - The function to call when a change is detected.
 * @returns {Proxy} An observable version of the object.
 */
export function createObservable(obj, callback) {
  // A handler for the Proxy, containing "traps" for operations.
  const handler = {
    get(target, prop, receiver) {
      // If the property is an object, return a new observable proxy for it (for nesting).
      const value = Reflect.get(target, prop, receiver)
      if (value && typeof value === 'object') {
        return createObservable(value, callback)
      }
      return value
    },
    set(target, prop, value, receiver) {
      // Set the property value using Reflect to ensure default behavior.
      const success = Reflect.set(target, prop, value, receiver)
      // If the set operation was successful, call the callback.
      if (success) {
        callback()
      }
      return success
    },
    deleteProperty(target, prop) {
      // Delete the property using Reflect.
      const success = Reflect.deleteProperty(target, prop)
      // If the deletion was successful, call the callback.
      if (success) {
        callback()
      }
      return success
    },
  }

  return new Proxy(obj, handler)
}
