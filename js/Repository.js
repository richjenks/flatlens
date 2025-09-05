// Simple repository pattern allowing automatic callbacks on state changes.
export class Repository {

	// Store the state
	state = null;

	// Set initial state
	constructor(initialState = {}) {
		this.state = { ...initialState };
		this.subscribers = new Set();
	}

	// Get current state
	get(key = null) {
		return key ? this.state[key] : this.state;
	}

	// Update state
	set(updates) {
		this.state = { ...this.state, ...updates };
		this.notify();
	}

	// Toggle a boolean value or cycle through predefined options
	toggle(key, optionsKey = null) {
		// If no options key provided, treat as a boolean toggle
		if (!optionsKey) {
			this.set({ [key]: !this.state[key] });
			return;
		}

		// Get current value and available options
		const currentValue = this.state[key];
		const options = this.state[optionsKey] || [];

		// Find current index and calculate next index (with wrap-around)
		const currentIndex = options.indexOf(currentValue);
		const nextIndex = (currentIndex + 1) % options.length;

		// Update to the next value
		this.set({ [key]: options[nextIndex] });
	}

	/**
	* Subscribe to state changes
	* @param {string|string[]} fields - Field(s) to watch for changes
	* @param {Function} callback - Function called when watched fields change
	* @returns {Function} Unsubscribe function (call to remove subscription)
	*
	* Note the callback is executed immediately with the current state.
	* If this is problematic, do an early return like `if (!s.key) return;`.
	*
	* @example
	* // Subscribe to a single field
	* Store.subscribe('time', s => {
	*   alert('Time updated:', s.time);
	* });
	*
	* @example
	* // Subscribe to multiple fields
	* Store.subscribe(['time', 'duration'], s => {
	*   alert(`Time: ${s.time}/${s.duration}`);
	* });
	*
	* @example
	* // Subscribe to all state changes (use sparingly)
	* Store.subscribe(s => {
	*   alert('s changed:', s);
	* });
	*/
	subscribe(fields, callback) {

		// Handle single callback parameter (watch all fields)
		const isWatchingAll = typeof fields === "function";
		const cb = isWatchingAll ? fields : callback;

		// Initial callback with current state
		cb(this.state);

		// Normalize fields to an array of field names
		const fieldsToWatch = isWatchingAll ? null : Array.isArray(fields) ? fields : [fields];

		/**
		* Get the relevant values from state based on watched fields
		* @param {Object} state - Current state object
		* @returns {Object} Relevant state values to compare
		*/
		const getRelevantValues = (state) => {
			if (isWatchingAll) {
				return state;
			}
			if (fieldsToWatch.length === 1) {
				return { [fieldsToWatch[0]]: state[fieldsToWatch[0]] };
			}
			const result = {};
			fieldsToWatch.forEach(field => {
				result[field] = state[field];
			});
			return result;
		};

		// Store initial state for comparison
		let lastValues = JSON.stringify(getRelevantValues(this.state));

		// Create wrapped callback that only fires when watched values change
		const wrappedCallback = (state) => {
			const currentValues = JSON.stringify(getRelevantValues(state));
			const hasChanged = currentValues !== lastValues;

			if (hasChanged) {
				lastValues = currentValues;
				cb(state);
			}
		};

		// Add to subscribers and return unsubscribe function
		this.subscribers.add(wrappedCallback);
		return () => this.subscribers.delete(wrappedCallback);
	}

	// Notify subscribers of state changes
	notify() {
		this.subscribers.forEach(callback => callback(this.state));
	}

}
