class SimpleContainer {
  constructor() {
    this.bindings = new Map()
    this.instances = new Map()
    this.isInitialized = false
  }

  bind(identifier) {
    if (!identifier) {
      throw new Error('Identifier cannot be null or undefined')
    }

    const binding = {
      identifier,
      to: null,
      factory: null,
      isSingleton: false,
      isDynamicValue: false,
    }

    this.bindings.set(identifier, binding)

    return {
      to: (constructor) => {
        if (typeof constructor !== 'function') {
          throw new Error(
            `Constructor must be a function for ${String(identifier)}`
          )
        }
        binding.to = constructor
        return {
          inSingletonScope: () => {
            binding.isSingleton = true
            return this
          },
        }
      },
      toDynamicValue: (factory) => {
        if (typeof factory !== 'function') {
          throw new Error(
            `Factory must be a function for ${String(identifier)}`
          )
        }
        binding.factory = factory
        binding.isDynamicValue = true
        return {
          inSingletonScope: () => {
            binding.isSingleton = true
            return this
          },
        }
      },
    }
  }

  get(identifier) {
    if (!identifier) {
      throw new Error('Cannot resolve service: identifier is null or undefined')
    }

    const binding = this.bindings.get(identifier)

    if (!binding) {
      const availableServices = Array.from(this.bindings.keys()).map((key) =>
        String(key)
      )
      throw new Error(
        `Service '${String(identifier)}' not found. Available services: [${availableServices.join(', ')}]`
      )
    }

    if (binding.isSingleton && this.instances.has(identifier)) {
      return this.instances.get(identifier)
    }

    let instance

    try {
      if (binding.isDynamicValue && binding.factory) {
        instance = binding.factory()
      } else if (binding.to) {
        // eslint-disable-next-line new-cap
        instance = new binding.to()
      } else {
        throw new Error(`No implementation found for '${String(identifier)}'`)
      }

      if (binding.isSingleton) {
        this.instances.set(identifier, instance)
      }

      return instance
    } catch (error) {
      throw new Error(
        `Failed to create instance of '${String(identifier)}': ${error.message}`
      )
    }
  }

  has(identifier) {
    return this.bindings.has(identifier)
  }

  validateBindings() {
    const missingDependencies = []

    for (const [identifier, binding] of this.bindings.entries()) {
      if (!binding.to && !binding.factory) {
        missingDependencies.push(String(identifier))
      }
    }

    if (missingDependencies.length > 0) {
      throw new Error(
        `Missing implementations for: ${missingDependencies.join(', ')}`
      )
    }

    this.isInitialized = true
  }

  listServices() {
    return Array.from(this.bindings.keys()).map((key) => String(key))
  }
}

module.exports = { SimpleContainer }
