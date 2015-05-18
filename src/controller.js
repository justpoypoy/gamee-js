// 
// Controller for ``gamee``
//
(function(global, gamee) {
	'use strict';

	/** ## Bullet 
	 *
	 * [Bullet.js](https://github.com/munkychop/bullet) is used as pub/sub
	 * library. 
	 * 
	 * The controller and its buttons are instance of Bullet.
	 */
	var BulletClass = Bullet.constructor;

	//
	// ## gamee.controller
	//
	// Namespace where the methods for controller are published.
	// 
	gamee.controller = {
		/** ### requestController
		 *
		 * Factory method to create a controller. It creates the controller
		 * and signals to GameeApp which type the game requires
		 *
		 * You should called this method once before calling
		 * `gamee.gameStart()`.
		 *
		 * @param {String} type type of controller ('OneButton', 'TwoButtons',
		 * 'FourButtons', 'FiveButtons', 'SixButtons', 'Touch')
		 * @param {Object} [opts] optional controller options 
		 * {'enableKeyboard': .., 'buttons': ...}
		 * @param {boolean} [opts.enableKeyboard] enable the keyboard
		 * @param {Object} [opts.buttons] remap buttons {'oldKey': 'newKey', 
		 * 'left': 'break' ..}
		 */
		requestController: function (type, opts) {
			var controller = createController(type, opts);

			global.$gameeNative.requestController(type);
			mainController = controller;
			
			return controller;
		},

		/** ### additionalController
		 * 
		 * Construct an additional controller. Sometimes games require a
		 * different controller depending on platform (eg. touch on mobile, 
		 * but Four Buttons on desktop)
		 *
		 * **This is currently supported only for GameeWebApp** as a way to 
		 * have alternate keybinding. The game should request a type used 
		 * for mobile platform and then some other as *additionalController*
		 * if alternate keybinding is needed;
		 */
		additionalController: function(type, opts) {
			var controller = createController(type, opts);
			global.$gameeNative.additionalController(type);

			return controller;
		},

		/** ### trigger
		 * 
		 * Triggers and event for the controller
		 *
		 * This is called by GameeApp to trigger the *keydown*, *keyup*
		 * events. For more info see [Controller](#controller)
		 * 
		 * @param {String} eventName name of the event
		 * @param {*} [data,...] data to pass for the event
		 *
		 */
		trigger: function() {
			var i;

			if (mainController) {
				mainController.trigger.apply(mainController, arguments); 
			} else {
				throw new Error('No controller present');
			}
		}
	};


	/** ## Button
	 *
	 * Represenation of a controller button. It is a child of 
	 * [Bullet](https://github.com/munkychop/bullet), so you can
	 * subscribe for events triggered on it. 
	 *
	 * @param {String} key name of the button
	 * @param {Number} keyCode keycode for the key to represent the button
	 * on keyboard
	 */
	function Button(key, keyCode) {
		var self = this;

		BulletClass.call(this);

		this._pressed = true;

		this.key = key;
		this.keyCode = keyCode;

		this.on('keydown', function() {
			self._pressed = true;
		});

		this.on('keyup', function() {
			self._pressed = false;
		});
	}

	Button.prototype = Object.create(BulletClass.constructor.prototype);
	Button.constructor = Button;

	/** ### isDown
	 * 
	 * Ask if the button is currently pressed.
	 *
	 * @return {Boolean} true if the button is currently pressed
	 */
	Button.prototype.isDown = function() {
		return this._pressed;
	};

	/** ## Controller
	 * 
	 * Controller has a collection of [buttons](#buttons).
	 * It is a child of 
	 * [Bullet](https://github.com/munkychop/bullet), so you can 
	 * subscribe for events triggered on it. 
	 *
	 * Controllers will get all the events for its buttons so you can
	 * listen for them globaly from controller or individualy on every
	 * button.
	 *
	 * ```javascript
	 * controller.on('keydown', function(data) {
	 *   console.log('button ' + data.button + ' is pressed');
	 * });
	 *
	 * controller.buttons.left.on('keydown', function() {
	 *   console.log('button left is pressed');
	 * });
	 * ```
	 */ 
	function Controller() {
		var self = this;

		BulletClass.call(this);

		// ### buttons
		//
		// Map of controller's [buttons](#button) by their name.
		//
		// ```javascript
		// controller.buttons.left // Button('left', ..)
		// ```
		this.buttons = {};

		// ### buttonAlias
		//
		// Map of remapped buttons.
		//
		// *see [remapButton](#remapbutton) for more info*
		//
		this.buttonAlias = {};

		// Events prefixed with *$* are private, sent from GameeApp ment
		// to be handled before resended as *public (non-prefixed)* 
		// event.
		//
		// They should be not used in games as they can change in the future.
		this.on('$keydown', function(data) {
			if (data.button && self.buttonAlias[data.button]) {
				data.button = self.buttonAlias[data.button];
			}

			self.trigger('keydown', data);
		});

		this.on('$keyup', function(data) {
			if (data.button && self.buttonAlias[data.button]) {
				data.button = self.buttonAlias[data.button];
			}

			self.trigger('keyup', data);
		});

	 	// By default GameeApp will trigger *keydown* and *keyup* events for
		// the controller for every button presses/released.
		// 
		// The controller then handles the event and triggers the event for
		// the coresponding button.
		// 
		// It expexts a `data` argument which should have a property `button`
		// with the name of button.
		this.on('keydown', function(data) {
			if (!data.button || !self.buttons[data.button]) {
				return;
			}

			self.buttons[data.button].trigger('keydown');
		});

		this.on('keyup', function(data) {
			if (!data.button || !self.buttons[data.button]) {
				return;
			}

			self.buttons[data.button].trigger('keyup');
		});
	}

	Controller.prototype = Object.create(BulletClass.constructor.prototype);
	Controller.constructor = Controller;

	/** ### addButton
	 *
	 * Add button to the controller.
	 * 
	 * @param {Button} button a [Button](#button) instance
	 */
	Controller.prototype.addButton = function(button) {
		this.buttons[button.key] = button;
	};

	/** ### enableKeyboard
	 * 
	 * Enable keyboard controlls. It will attach event listeners to the 
	 * *window* object for every button and trigger their *keydown* /
	 * *keyup* event for the controller.
	 */
	Controller.prototype.enableKeyboard = function() {
		var key, button, keyCodes = {}, self = this;

		for (key in this.buttons) {
			button = this.buttons[key];

			if (button.keyCode) {
				keyCodes[button.keyCode] = button;
			}
		}

		gamee._keydown(function(ev) {
			var button = keyCodes[ev.keyCode];

			if (!button) {
				return;
			}

			ev.preventDefault();
			self.trigger('keydown', {button: button.key});
		});
		
		gamee._keyup(function(ev) {
			var button = keyCodes[ev.keyCode];

			if (!button) {
				return;
			}

			ev.preventDefault();
			self.trigger('keyup', {button: button.key});
		});
	};

	/** ### remapButton
	 * 
	 * Remap the names of the controller's buttons. Controllers have their
	 * button names set (left, right, A, B), but sometimes in context of 
	 * the game a different names are desired.
	 *
	 * ```javascript
	 * var controller = gamee.controller.requestController('TwoButtons');
	 * controller.remapButton('left', 'throttle');
	 * controller.remapButton('right', 'break');
	 * 
	 * controller.buttons.throttle.on('keydown', ..);
	 * ```
	 */
	Controller.prototype.remapButton = function(oldName, newProp) {
		if (this.buttons[oldName]) {
			this.buttonAlias[oldName] = newProp.name;
			
			this.buttons[newProp.name] = this.buttons[oldName];

			delete this.buttons[oldName];
		}
	};

	// ## Controllers 

	/** ### OneButtonController
	 *
	 * Controller with only one button.
	 */
	function OneButtonController() {
		Controller.call(this);

		// * __name__: 'button' 
		// * __key__: spacebar
		this.addButton(new Button('button', 32)); 
	}
	OneButtonController.prototype = Object.create(Controller.prototype);
	OneButtonController.prototype.constructor = OneButtonController;


	/** ### TwoButtonController
	 *
	 * Controller with two buttons
	 */
	function TwoButtonController() {
		Controller.call(this);

		// * __name__: 'left'
		// * __key__: left arrow
		this.addButton(new Button('left', 37)); 

		// * __name__: 'right'
		// * __key__: righ arrow
		this.addButton(new Button('right', 39));
	}
	TwoButtonController.prototype = Object.create(Controller.prototype);
	TwoButtonController.prototype.constructor = TwoButtonController;


	/** ### FourButtonController
	 *
	 * Controller with four buttons
	 */
	function FourButtonController() {
		Controller.call(this);

		// * __name__: 'up'
		// * __key__: left arrow
		this.addButton(new Button('up', 38));

		// * __name__: 'left'
		// * __key__: left arrow
		this.addButton(new Button('left', 37));  

		
		// * __name__: 'right'
		// * __key__: righ arrow
		this.addButton(new Button('right', 39)); 

		// * __name__: 'A'
		// * __key__: spacebar
		this.addButton(new Button('A', 32));     
	}
	FourButtonController.prototype = Object.create(Controller.prototype);
	FourButtonController.prototype.constructor = FourButtonController;

	/** ### FiveButtonController
	 *
	 * Controller with five buttons
	 */
	function FiveButtonController() {
		Controller.call(this);

		// * __name__: 'up'
		// * __key__: left arrow
		this.addButton(new Button('up', 38));

		// * __name__: 'left'
		// * __key__: left arrow
		this.addButton(new Button('left', 37));  

		
		// * __name__: 'right'
		// * __key__: righ arrow
		this.addButton(new Button('right', 39)); 

		// * __name__: 'down'
		// * __key__: down arrow
		this.addButton(new Button('down', 40));  

		// * __name__: 'A'
		// * __key__: spacebar
		this.addButton(new Button('A', 32));     
	}
	FiveButtonController.prototype = Object.create(Controller.prototype);
	FiveButtonController.prototype.constructor = FiveButtonController;

	/** ### SixButtonController
	 *
	 * Controller with six buttons
	 */
	function SixButtonController() {
		Controller.call(this);

		// * __name__: 'up'
		// * __key__: left arrow
		this.addButton(new Button('up', 38));

		// * __name__: 'left'
		// * __key__: left arrow
		this.addButton(new Button('left', 37));  

		
		// * __name__: 'right'
		// * __key__: righ arrow
		this.addButton(new Button('right', 39)); 

		// * __name__: 'down'
		// * __key__: down arrow
		this.addButton(new Button('down', 40));  

		// * __name__: 'A'
		// * __key__: spacebar
		this.addButton(new Button('A', 32));     

		// * __name__: 'B'
		// * __key__: ctrl
		this.addButton(new Button('B', 17));
	}
	SixButtonController.prototype = Object.create(Controller.prototype);
	SixButtonController.prototype.constructor = SixButtonController;

	/** ### TouchController 
	 *
	 * This controller has no buttons. Instead it has a touchpad which
	 * triggers *touchstart*, *touchend*, *touchmove*, *touchcancel*,
	 * *touchend* events (similar to 
	 * [Touch event types](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent#Touch_event_types))
	 *
	 * The position of the touch is in the `data.position` argument as a 
	 * *x* and *y* with the values between [0, 0] for the left top corner
	 * and [1, 1] for the bottom right corner ([0.5, 0.5] is the center).
	 *
	 * ```javascript
	 * controller = gamee.controller.requestController('Touch');
	 *
	 * controller.on('touchstart', function(data) {
	 *	if (data.position.x < 0.5 && data.position.y < 0.5) {
	 *    console.log('touch in the top left quadrant');
	 *  }
	 * })
	 * ```
	 */
	function TouchController() {
		var self = this;

		Controller.call(this);

		this.on("$touchstart", function(data) {
			self.trigger('touchstart', data);
		});

		this.on("$touchend", function(data) {
			self.trigger('touchend', data);
		});

		this.on("$touchmove", function(data) {
			self.trigger('touchmove', data);
		});

		this.on("$touchleave", function(data) {
			self.trigger('touchleave', data);
		});

		this.on("$touchcancel", function(data) {
			self.trigger('touchcancel', data);
		});
	}
	TouchController.prototype = Object.create(TouchController.prototype);
	TouchController.prototype.constructor = TouchController;

	//
	// ## Private objects and methods
	// These are internal objects in closed scope. Good to know about them
	// when debugging.


	/** ### createController
	 * 
	 * Function to create a controller.
	 *
	 * *see [requestController](#requestcontroller)
	 *
	 * @param {String} type
	 * @param {Object} [opts]
	 * @returns {Controller} controller
	 */
	function createController(type, opts) {
		var btn, controller;

		if (!controllerTypes[type]) {
			throw new Error('Unsupported controller type, ' + type);
		}

		opts = opts || {};

		controller = new controllerTypes[type]();

		if (opts.enableKeyboard) {
			controller.enableKeyboard();
		}

		if (opts.buttons) {
			for (btn in opts.buttons) {
				controller.remapButton(btn, opts.buttons[btn]);
			}
		}

		return controller;
	}


	/** ### mainController
	 * 
	 * Current controller.
	 */
	var mainController; 

	/** ### controllerTypes
	 *
	 * List of controller types and their coresponding classes.
	 *
	 * *see [Controllers](#controllers) for more info*
	 */
	var controllerTypes = {
		'OneButton': OneButtonController,
		'TwoButtons': TwoButtonController,
		'FourButtons': FourButtonController,
		'FiveButtons': FiveButtonController,
		'SixButtons': SixButtonController,
		'Touch': TouchController
	};
}(this, gamee));
