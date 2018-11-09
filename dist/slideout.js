(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Slideout = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

/**
 * Module dependencies
 */
var decouple = require("decouple");
var Emitter = require("emitter");

/**
 * Privates
 */
var scrollTimeout;
var scrolling = false;
var doc = window.document;
var html = doc.documentElement;
var msPointerSupported = window.navigator.msPointerEnabled;
var touch = {
  start: msPointerSupported ? "MSPointerDown" : "touchstart",
  move: msPointerSupported ? "MSPointerMove" : "touchmove",
  end: msPointerSupported ? "MSPointerUp" : "touchend",
};
var prefix = (function prefix() {
  var regex = /^(Webkit|Khtml|Moz|ms|O)(?=[A-Z])/;
  var styleDeclaration = doc.getElementsByTagName("script")[0].style;
  for (var prop in styleDeclaration) {
    if (regex.test(prop)) {
      return "-" + prop.match(regex)[0].toLowerCase() + "-";
    }
  }
  // Nothing found so far? Webkit does not enumerate over the CSS properties of the style object.
  // However (prop in style) returns the correct value, so we'll have to test for
  // the precence of a specific property
  if ("WebkitOpacity" in styleDeclaration) {
    return "-webkit-";
  }
  if ("KhtmlOpacity" in styleDeclaration) {
    return "-khtml-";
  }
  return "";
})();
function extend(destination, from) {
  for (var prop in from) {
    if (from[prop]) {
      destination[prop] = from[prop];
    }
  }
  return destination;
}
function inherits(child, uber) {
  child.prototype = extend(child.prototype || {}, uber.prototype);
}
function hasIgnoredElements(el) {
  while (el.parentNode) {
    if (el.getAttribute("data-slideout-ignore") !== null) {
      return el;
    }
    el = el.parentNode;
  }
  return null;
}

/**
 * Slideout constructor
 */
function Slideout(options) {
  options = options || {};

  // Sets default values
  this._startOffsetX = 0;
  this._currentOffsetX = 0;
  this._opening = false;
  this._moved = false;
  this._opened = false;
  this._preventOpen = false;

  // Sets panel
  this.panel = options.panel;
  this.menu = options.menu;

  // Sets options
  this._touch = options.touch === undefined ? true : options.touch && true;
  this._side = options.side || "left";
  this._easing = options.fx || options.easing || "ease";

  var duration = parseInt(options.duration, 10);
  this._duration = isNaN(duration) ? 300 : duration;

  var tolerance = parseInt(options.tolerance, 10);
  this._tolerance = isNaN(tolerance) ? 70 : tolerance;

  var padding = parseInt(options.padding, 10);
  this._padding = this._translateTo = isNaN(padding) ? 256 : padding;

  this._orientation = this._side === "right" ? -1 : 1;
  this._translateTo *= this._orientation;

  // Sets  classnames
  if (!this.panel.classList.contains("slideout-panel")) {
    this.panel.classList.add("slideout-panel");
  }
  if (!this.panel.classList.contains("slideout-panel-" + this._side)) {
    this.panel.classList.add("slideout-panel-" + this._side);
  }
  if (!this.menu.classList.contains("slideout-menu")) {
    this.menu.classList.add("slideout-menu");
  }
  if (!this.menu.classList.contains("slideout-menu-" + this._side)) {
    this.menu.classList.add("slideout-menu-" + this._side);
  }

  // Init touch events
  if (this._touch) {
    this._initTouchEvents();
  }
}

/**
 * Inherits from Emitter
 */
inherits(Slideout, Emitter);

/**
 * Opens the slideout menu.
 */
Slideout.prototype.open = function() {
  var self = this;
  this.emit("beforeopen");
  if (!html.classList.contains("slideout-open")) {
    html.classList.add("slideout-open");
  }
  this._setTransition();
  this._translateXTo(this._translateTo);
  this._opened = true;
  setTimeout(function() {
    self.panel.style.transition = self.panel.style["-webkit-transition"] = "";
    self.emit("open");
  }, this._duration + 50);
  return this;
};

/**
 * Closes slideout menu.
 */
Slideout.prototype.close = function() {
  var self = this;
  if (!this.isOpen() && !this._opening) {
    return this;
  }
  this.emit("beforeclose");
  this._setTransition();
  this._translateXTo(0);
  this._opened = false;
  setTimeout(function() {
    html.classList.remove("slideout-open");
    self.panel.style.transition = self.panel.style["-webkit-transition"] = self.panel.style[
      prefix + "transform"
    ] = self.panel.style.transform = "";
    self.emit("close");
  }, this._duration + 50);
  return this;
};

/**
 * Toggles (open/close) slideout menu.
 */
Slideout.prototype.toggle = function() {
  return this.isOpen() ? this.close() : this.open();
};

/**
 * Returns true if the slideout is currently open, and false if it is closed.
 */
Slideout.prototype.isOpen = function() {
  return this._opened;
};

/**
 * Translates panel and updates currentOffset with a given X point
 */
Slideout.prototype._translateXTo = function(translateX) {
  this._currentOffsetX = translateX;
  this.panel.style[prefix + "transform"] = this.panel.style.transform = "translateX(" + translateX + "px)";
  return this;
};

/**
 * Set transition properties
 */
Slideout.prototype._setTransition = function() {
  this.panel.style[prefix + "transition"] = this.panel.style.transition =
    prefix + "transform " + this._duration + "ms " + this._easing;
  return this;
};

/**
 * Initializes touch event
 */
Slideout.prototype._initTouchEvents = function() {
  var self = this;

  /**
   * Decouple scroll event
   */
  this._onScrollFn = decouple(doc, "scroll", function() {
    if (!self._moved) {
      clearTimeout(scrollTimeout);
      scrolling = true;
      scrollTimeout = setTimeout(function() {
        scrolling = false;
      }, 250);
    }
  });

  /**
   * Prevents touchmove event if slideout is moving
   */
  this._preventMove = function(eve) {
    if (self._moved) {
      eve.preventDefault();
    }
  };

  doc.addEventListener(touch.move, this._preventMove);

  /**
   * Resets values on touchstart
   */
  this._resetTouchFn = function(eve) {
    if (typeof eve.touches === "undefined") {
      return;
    }

    self._moved = false;
    self._opening = false;
    self._startOffsetX = eve.touches[0].pageX;
    self._preventOpen = !self._touch || (!self.isOpen() && self.menu.clientWidth !== 0);
  };

  this.panel.addEventListener(touch.start, this._resetTouchFn);

  /**
   * Resets values on touchcancel
   */
  this._onTouchCancelFn = function() {
    self._moved = false;
    self._opening = false;
  };

  this.panel.addEventListener("touchcancel", this._onTouchCancelFn);

  /**
   * Toggles slideout on touchend
   */
  this._onTouchEndFn = function() {
    if (self._moved) {
      self.emit("translateend");
      self._opening && Math.abs(self._currentOffsetX) > self._tolerance ? self.open() : self.close();
    }
    self._moved = false;
  };

  this.panel.addEventListener(touch.end, this._onTouchEndFn);

  /**
   * Translates panel on touchmove
   */
  this._onTouchMoveFn = function(eve) {
    if (scrolling || self._preventOpen || typeof eve.touches === "undefined" || hasIgnoredElements(eve.target)) {
      return;
    }

    var dif_x = eve.touches[0].clientX - self._startOffsetX;
    var translateX = (self._currentOffsetX = dif_x);

    if (Math.abs(translateX) > self._padding) {
      return;
    }

    if (Math.abs(dif_x) > 20) {
      self._opening = true;

      var oriented_dif_x = dif_x * self._orientation;

      if ((self._opened && oriented_dif_x > 0) || (!self._opened && oriented_dif_x < 0)) {
        return;
      }

      if (!self._moved) {
        self.emit("translatestart");
      }

      if (oriented_dif_x <= 0) {
        translateX = dif_x + self._padding * self._orientation;
        self._opening = false;
      }

      if (!(self._moved && html.classList.contains("slideout-open"))) {
        html.classList.add("slideout-open");
      }

      self.panel.style[prefix + "transform"] = self.panel.style.transform = "translateX(" + translateX + "px)";
      self.emit("translate", translateX);
      self._moved = true;
    }
  };

  this.panel.addEventListener(touch.move, this._onTouchMoveFn);

  return this;
};

/**
 * Enable opening the slideout via touch events.
 */
Slideout.prototype.enableTouch = function() {
  this._touch = true;
  return this;
};

/**
 * Disable opening the slideout via touch events.
 */
Slideout.prototype.disableTouch = function() {
  this._touch = false;
  return this;
};

/**
 * Destroy an instance of slideout.
 */
Slideout.prototype.destroy = function() {
  // Close before clean
  this.close();

  // Remove event listeners
  doc.removeEventListener(touch.move, this._preventMove);
  this.panel.removeEventListener(touch.start, this._resetTouchFn);
  this.panel.removeEventListener("touchcancel", this._onTouchCancelFn);
  this.panel.removeEventListener(touch.end, this._onTouchEndFn);
  this.panel.removeEventListener(touch.move, this._onTouchMoveFn);
  doc.removeEventListener("scroll", this._onScrollFn);

  // Remove methods
  this.open = this.close = function() {};

  // Return the instance so it can be easily dereferenced
  return this;
};

/**
 * Expose Slideout
 */
module.exports = Slideout;

},{"decouple":2,"emitter":3}],2:[function(require,module,exports){
'use strict';

var requestAnimFrame = (function() {
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    function (callback) {
      window.setTimeout(callback, 1000 / 60);
    };
}());

function decouple(node, event, fn) {
  var eve,
      tracking = false;

  function captureEvent(e) {
    eve = e;
    track();
  }

  function track() {
    if (!tracking) {
      requestAnimFrame(update);
      tracking = true;
    }
  }

  function update() {
    fn.call(node, eve);
    tracking = false;
  }

  node.addEventListener(event, captureEvent, false);

  return captureEvent;
}

/**
 * Expose decouple
 */
module.exports = decouple;

},{}],3:[function(require,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

exports.__esModule = true;
/**
 * Creates a new instance of Emitter.
 * @class
 * @returns {Object} Returns a new instance of Emitter.
 * @example
 * // Creates a new instance of Emitter.
 * var Emitter = require('emitter');
 *
 * var emitter = new Emitter();
 */

var Emitter = (function () {
  function Emitter() {
    _classCallCheck(this, Emitter);
  }

  /**
   * Adds a listener to the collection for the specified event.
   * @memberof! Emitter.prototype
   * @function
   * @param {String} event - The event name.
   * @param {Function} listener - A listener function to add.
   * @returns {Object} Returns an instance of Emitter.
   * @example
   * // Add an event listener to "foo" event.
   * emitter.on('foo', listener);
   */

  Emitter.prototype.on = function on(event, listener) {
    // Use the current collection or create it.
    this._eventCollection = this._eventCollection || {};

    // Use the current collection of an event or create it.
    this._eventCollection[event] = this._eventCollection[event] || [];

    // Appends the listener into the collection of the given event
    this._eventCollection[event].push(listener);

    return this;
  };

  /**
   * Adds a listener to the collection for the specified event that will be called only once.
   * @memberof! Emitter.prototype
   * @function
   * @param {String} event - The event name.
   * @param {Function} listener - A listener function to add.
   * @returns {Object} Returns an instance of Emitter.
   * @example
   * // Will add an event handler to "foo" event once.
   * emitter.once('foo', listener);
   */

  Emitter.prototype.once = function once(event, listener) {
    var self = this;

    function fn() {
      self.off(event, fn);
      listener.apply(this, arguments);
    }

    fn.listener = listener;

    this.on(event, fn);

    return this;
  };

  /**
   * Removes a listener from the collection for the specified event.
   * @memberof! Emitter.prototype
   * @function
   * @param {String} event - The event name.
   * @param {Function} listener - A listener function to remove.
   * @returns {Object} Returns an instance of Emitter.
   * @example
   * // Remove a given listener.
   * emitter.off('foo', listener);
   */

  Emitter.prototype.off = function off(event, listener) {

    var listeners = undefined;

    // Defines listeners value.
    if (!this._eventCollection || !(listeners = this._eventCollection[event])) {
      return this;
    }

    listeners.forEach(function (fn, i) {
      if (fn === listener || fn.listener === listener) {
        // Removes the given listener.
        listeners.splice(i, 1);
      }
    });

    // Removes an empty event collection.
    if (listeners.length === 0) {
      delete this._eventCollection[event];
    }

    return this;
  };

  /**
   * Execute each item in the listener collection in order with the specified data.
   * @memberof! Emitter.prototype
   * @function
   * @param {String} event - The name of the event you want to emit.
   * @param {...Object} data - Data to pass to the listeners.
   * @returns {Object} Returns an instance of Emitter.
   * @example
   * // Emits the "foo" event with 'param1' and 'param2' as arguments.
   * emitter.emit('foo', 'param1', 'param2');
   */

  Emitter.prototype.emit = function emit(event) {
    var _this = this;

    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    var listeners = undefined;

    // Defines listeners value.
    if (!this._eventCollection || !(listeners = this._eventCollection[event])) {
      return this;
    }

    // Clone listeners
    listeners = listeners.slice(0);

    listeners.forEach(function (fn) {
      return fn.apply(_this, args);
    });

    return this;
  };

  return Emitter;
})();

/**
 * Exports Emitter
 */
exports["default"] = Emitter;
module.exports = exports["default"];
},{}]},{},[1])(1)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvdXBsZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lbWl0dGVyL2Rpc3QvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIlwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXNcclxuICovXHJcbnZhciBkZWNvdXBsZSA9IHJlcXVpcmUoXCJkZWNvdXBsZVwiKTtcclxudmFyIEVtaXR0ZXIgPSByZXF1aXJlKFwiZW1pdHRlclwiKTtcclxuXHJcbi8qKlxyXG4gKiBQcml2YXRlc1xyXG4gKi9cclxudmFyIHNjcm9sbFRpbWVvdXQ7XHJcbnZhciBzY3JvbGxpbmcgPSBmYWxzZTtcclxudmFyIGRvYyA9IHdpbmRvdy5kb2N1bWVudDtcclxudmFyIGh0bWwgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xyXG52YXIgbXNQb2ludGVyU3VwcG9ydGVkID0gd2luZG93Lm5hdmlnYXRvci5tc1BvaW50ZXJFbmFibGVkO1xyXG52YXIgdG91Y2ggPSB7XHJcbiAgc3RhcnQ6IG1zUG9pbnRlclN1cHBvcnRlZCA/IFwiTVNQb2ludGVyRG93blwiIDogXCJ0b3VjaHN0YXJ0XCIsXHJcbiAgbW92ZTogbXNQb2ludGVyU3VwcG9ydGVkID8gXCJNU1BvaW50ZXJNb3ZlXCIgOiBcInRvdWNobW92ZVwiLFxyXG4gIGVuZDogbXNQb2ludGVyU3VwcG9ydGVkID8gXCJNU1BvaW50ZXJVcFwiIDogXCJ0b3VjaGVuZFwiLFxyXG59O1xyXG52YXIgcHJlZml4ID0gKGZ1bmN0aW9uIHByZWZpeCgpIHtcclxuICB2YXIgcmVnZXggPSAvXihXZWJraXR8S2h0bWx8TW96fG1zfE8pKD89W0EtWl0pLztcclxuICB2YXIgc3R5bGVEZWNsYXJhdGlvbiA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNjcmlwdFwiKVswXS5zdHlsZTtcclxuICBmb3IgKHZhciBwcm9wIGluIHN0eWxlRGVjbGFyYXRpb24pIHtcclxuICAgIGlmIChyZWdleC50ZXN0KHByb3ApKSB7XHJcbiAgICAgIHJldHVybiBcIi1cIiArIHByb3AubWF0Y2gocmVnZXgpWzBdLnRvTG93ZXJDYXNlKCkgKyBcIi1cIjtcclxuICAgIH1cclxuICB9XHJcbiAgLy8gTm90aGluZyBmb3VuZCBzbyBmYXI/IFdlYmtpdCBkb2VzIG5vdCBlbnVtZXJhdGUgb3ZlciB0aGUgQ1NTIHByb3BlcnRpZXMgb2YgdGhlIHN0eWxlIG9iamVjdC5cclxuICAvLyBIb3dldmVyIChwcm9wIGluIHN0eWxlKSByZXR1cm5zIHRoZSBjb3JyZWN0IHZhbHVlLCBzbyB3ZSdsbCBoYXZlIHRvIHRlc3QgZm9yXHJcbiAgLy8gdGhlIHByZWNlbmNlIG9mIGEgc3BlY2lmaWMgcHJvcGVydHlcclxuICBpZiAoXCJXZWJraXRPcGFjaXR5XCIgaW4gc3R5bGVEZWNsYXJhdGlvbikge1xyXG4gICAgcmV0dXJuIFwiLXdlYmtpdC1cIjtcclxuICB9XHJcbiAgaWYgKFwiS2h0bWxPcGFjaXR5XCIgaW4gc3R5bGVEZWNsYXJhdGlvbikge1xyXG4gICAgcmV0dXJuIFwiLWtodG1sLVwiO1xyXG4gIH1cclxuICByZXR1cm4gXCJcIjtcclxufSkoKTtcclxuZnVuY3Rpb24gZXh0ZW5kKGRlc3RpbmF0aW9uLCBmcm9tKSB7XHJcbiAgZm9yICh2YXIgcHJvcCBpbiBmcm9tKSB7XHJcbiAgICBpZiAoZnJvbVtwcm9wXSkge1xyXG4gICAgICBkZXN0aW5hdGlvbltwcm9wXSA9IGZyb21bcHJvcF07XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBkZXN0aW5hdGlvbjtcclxufVxyXG5mdW5jdGlvbiBpbmhlcml0cyhjaGlsZCwgdWJlcikge1xyXG4gIGNoaWxkLnByb3RvdHlwZSA9IGV4dGVuZChjaGlsZC5wcm90b3R5cGUgfHwge30sIHViZXIucHJvdG90eXBlKTtcclxufVxyXG5mdW5jdGlvbiBoYXNJZ25vcmVkRWxlbWVudHMoZWwpIHtcclxuICB3aGlsZSAoZWwucGFyZW50Tm9kZSkge1xyXG4gICAgaWYgKGVsLmdldEF0dHJpYnV0ZShcImRhdGEtc2xpZGVvdXQtaWdub3JlXCIpICE9PSBudWxsKSB7XHJcbiAgICAgIHJldHVybiBlbDtcclxuICAgIH1cclxuICAgIGVsID0gZWwucGFyZW50Tm9kZTtcclxuICB9XHJcbiAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTbGlkZW91dCBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gU2xpZGVvdXQob3B0aW9ucykge1xyXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG5cclxuICAvLyBTZXRzIGRlZmF1bHQgdmFsdWVzXHJcbiAgdGhpcy5fc3RhcnRPZmZzZXRYID0gMDtcclxuICB0aGlzLl9jdXJyZW50T2Zmc2V0WCA9IDA7XHJcbiAgdGhpcy5fb3BlbmluZyA9IGZhbHNlO1xyXG4gIHRoaXMuX21vdmVkID0gZmFsc2U7XHJcbiAgdGhpcy5fb3BlbmVkID0gZmFsc2U7XHJcbiAgdGhpcy5fcHJldmVudE9wZW4gPSBmYWxzZTtcclxuXHJcbiAgLy8gU2V0cyBwYW5lbFxyXG4gIHRoaXMucGFuZWwgPSBvcHRpb25zLnBhbmVsO1xyXG4gIHRoaXMubWVudSA9IG9wdGlvbnMubWVudTtcclxuXHJcbiAgLy8gU2V0cyBvcHRpb25zXHJcbiAgdGhpcy5fdG91Y2ggPSBvcHRpb25zLnRvdWNoID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0aW9ucy50b3VjaCAmJiB0cnVlO1xyXG4gIHRoaXMuX3NpZGUgPSBvcHRpb25zLnNpZGUgfHwgXCJsZWZ0XCI7XHJcbiAgdGhpcy5fZWFzaW5nID0gb3B0aW9ucy5meCB8fCBvcHRpb25zLmVhc2luZyB8fCBcImVhc2VcIjtcclxuXHJcbiAgdmFyIGR1cmF0aW9uID0gcGFyc2VJbnQob3B0aW9ucy5kdXJhdGlvbiwgMTApO1xyXG4gIHRoaXMuX2R1cmF0aW9uID0gaXNOYU4oZHVyYXRpb24pID8gMzAwIDogZHVyYXRpb247XHJcblxyXG4gIHZhciB0b2xlcmFuY2UgPSBwYXJzZUludChvcHRpb25zLnRvbGVyYW5jZSwgMTApO1xyXG4gIHRoaXMuX3RvbGVyYW5jZSA9IGlzTmFOKHRvbGVyYW5jZSkgPyA3MCA6IHRvbGVyYW5jZTtcclxuXHJcbiAgdmFyIHBhZGRpbmcgPSBwYXJzZUludChvcHRpb25zLnBhZGRpbmcsIDEwKTtcclxuICB0aGlzLl9wYWRkaW5nID0gdGhpcy5fdHJhbnNsYXRlVG8gPSBpc05hTihwYWRkaW5nKSA/IDI1NiA6IHBhZGRpbmc7XHJcblxyXG4gIHRoaXMuX29yaWVudGF0aW9uID0gdGhpcy5fc2lkZSA9PT0gXCJyaWdodFwiID8gLTEgOiAxO1xyXG4gIHRoaXMuX3RyYW5zbGF0ZVRvICo9IHRoaXMuX29yaWVudGF0aW9uO1xyXG5cclxuICAvLyBTZXRzICBjbGFzc25hbWVzXHJcbiAgaWYgKCF0aGlzLnBhbmVsLmNsYXNzTGlzdC5jb250YWlucyhcInNsaWRlb3V0LXBhbmVsXCIpKSB7XHJcbiAgICB0aGlzLnBhbmVsLmNsYXNzTGlzdC5hZGQoXCJzbGlkZW91dC1wYW5lbFwiKTtcclxuICB9XHJcbiAgaWYgKCF0aGlzLnBhbmVsLmNsYXNzTGlzdC5jb250YWlucyhcInNsaWRlb3V0LXBhbmVsLVwiICsgdGhpcy5fc2lkZSkpIHtcclxuICAgIHRoaXMucGFuZWwuY2xhc3NMaXN0LmFkZChcInNsaWRlb3V0LXBhbmVsLVwiICsgdGhpcy5fc2lkZSk7XHJcbiAgfVxyXG4gIGlmICghdGhpcy5tZW51LmNsYXNzTGlzdC5jb250YWlucyhcInNsaWRlb3V0LW1lbnVcIikpIHtcclxuICAgIHRoaXMubWVudS5jbGFzc0xpc3QuYWRkKFwic2xpZGVvdXQtbWVudVwiKTtcclxuICB9XHJcbiAgaWYgKCF0aGlzLm1lbnUuY2xhc3NMaXN0LmNvbnRhaW5zKFwic2xpZGVvdXQtbWVudS1cIiArIHRoaXMuX3NpZGUpKSB7XHJcbiAgICB0aGlzLm1lbnUuY2xhc3NMaXN0LmFkZChcInNsaWRlb3V0LW1lbnUtXCIgKyB0aGlzLl9zaWRlKTtcclxuICB9XHJcblxyXG4gIC8vIEluaXQgdG91Y2ggZXZlbnRzXHJcbiAgaWYgKHRoaXMuX3RvdWNoKSB7XHJcbiAgICB0aGlzLl9pbml0VG91Y2hFdmVudHMoKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbmhlcml0cyBmcm9tIEVtaXR0ZXJcclxuICovXHJcbmluaGVyaXRzKFNsaWRlb3V0LCBFbWl0dGVyKTtcclxuXHJcbi8qKlxyXG4gKiBPcGVucyB0aGUgc2xpZGVvdXQgbWVudS5cclxuICovXHJcblNsaWRlb3V0LnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24oKSB7XHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gIHRoaXMuZW1pdChcImJlZm9yZW9wZW5cIik7XHJcbiAgaWYgKCFodG1sLmNsYXNzTGlzdC5jb250YWlucyhcInNsaWRlb3V0LW9wZW5cIikpIHtcclxuICAgIGh0bWwuY2xhc3NMaXN0LmFkZChcInNsaWRlb3V0LW9wZW5cIik7XHJcbiAgfVxyXG4gIHRoaXMuX3NldFRyYW5zaXRpb24oKTtcclxuICB0aGlzLl90cmFuc2xhdGVYVG8odGhpcy5fdHJhbnNsYXRlVG8pO1xyXG4gIHRoaXMuX29wZW5lZCA9IHRydWU7XHJcbiAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgIHNlbGYucGFuZWwuc3R5bGUudHJhbnNpdGlvbiA9IHNlbGYucGFuZWwuc3R5bGVbXCItd2Via2l0LXRyYW5zaXRpb25cIl0gPSBcIlwiO1xyXG4gICAgc2VsZi5lbWl0KFwib3BlblwiKTtcclxuICB9LCB0aGlzLl9kdXJhdGlvbiArIDUwKTtcclxuICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBDbG9zZXMgc2xpZGVvdXQgbWVudS5cclxuICovXHJcblNsaWRlb3V0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xyXG4gIHZhciBzZWxmID0gdGhpcztcclxuICBpZiAoIXRoaXMuaXNPcGVuKCkgJiYgIXRoaXMuX29wZW5pbmcpIHtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuICB0aGlzLmVtaXQoXCJiZWZvcmVjbG9zZVwiKTtcclxuICB0aGlzLl9zZXRUcmFuc2l0aW9uKCk7XHJcbiAgdGhpcy5fdHJhbnNsYXRlWFRvKDApO1xyXG4gIHRoaXMuX29wZW5lZCA9IGZhbHNlO1xyXG4gIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICBodG1sLmNsYXNzTGlzdC5yZW1vdmUoXCJzbGlkZW91dC1vcGVuXCIpO1xyXG4gICAgc2VsZi5wYW5lbC5zdHlsZS50cmFuc2l0aW9uID0gc2VsZi5wYW5lbC5zdHlsZVtcIi13ZWJraXQtdHJhbnNpdGlvblwiXSA9IHNlbGYucGFuZWwuc3R5bGVbXHJcbiAgICAgIHByZWZpeCArIFwidHJhbnNmb3JtXCJcclxuICAgIF0gPSBzZWxmLnBhbmVsLnN0eWxlLnRyYW5zZm9ybSA9IFwiXCI7XHJcbiAgICBzZWxmLmVtaXQoXCJjbG9zZVwiKTtcclxuICB9LCB0aGlzLl9kdXJhdGlvbiArIDUwKTtcclxuICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBUb2dnbGVzIChvcGVuL2Nsb3NlKSBzbGlkZW91dCBtZW51LlxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiB0aGlzLmlzT3BlbigpID8gdGhpcy5jbG9zZSgpIDogdGhpcy5vcGVuKCk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBzbGlkZW91dCBpcyBjdXJyZW50bHkgb3BlbiwgYW5kIGZhbHNlIGlmIGl0IGlzIGNsb3NlZC5cclxuICovXHJcblNsaWRlb3V0LnByb3RvdHlwZS5pc09wZW4gPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4gdGhpcy5fb3BlbmVkO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFRyYW5zbGF0ZXMgcGFuZWwgYW5kIHVwZGF0ZXMgY3VycmVudE9mZnNldCB3aXRoIGEgZ2l2ZW4gWCBwb2ludFxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLl90cmFuc2xhdGVYVG8gPSBmdW5jdGlvbih0cmFuc2xhdGVYKSB7XHJcbiAgdGhpcy5fY3VycmVudE9mZnNldFggPSB0cmFuc2xhdGVYO1xyXG4gIHRoaXMucGFuZWwuc3R5bGVbcHJlZml4ICsgXCJ0cmFuc2Zvcm1cIl0gPSB0aGlzLnBhbmVsLnN0eWxlLnRyYW5zZm9ybSA9IFwidHJhbnNsYXRlWChcIiArIHRyYW5zbGF0ZVggKyBcInB4KVwiO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNldCB0cmFuc2l0aW9uIHByb3BlcnRpZXNcclxuICovXHJcblNsaWRlb3V0LnByb3RvdHlwZS5fc2V0VHJhbnNpdGlvbiA9IGZ1bmN0aW9uKCkge1xyXG4gIHRoaXMucGFuZWwuc3R5bGVbcHJlZml4ICsgXCJ0cmFuc2l0aW9uXCJdID0gdGhpcy5wYW5lbC5zdHlsZS50cmFuc2l0aW9uID1cclxuICAgIHByZWZpeCArIFwidHJhbnNmb3JtIFwiICsgdGhpcy5fZHVyYXRpb24gKyBcIm1zIFwiICsgdGhpcy5fZWFzaW5nO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEluaXRpYWxpemVzIHRvdWNoIGV2ZW50XHJcbiAqL1xyXG5TbGlkZW91dC5wcm90b3R5cGUuX2luaXRUb3VjaEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xyXG4gIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgLyoqXHJcbiAgICogRGVjb3VwbGUgc2Nyb2xsIGV2ZW50XHJcbiAgICovXHJcbiAgdGhpcy5fb25TY3JvbGxGbiA9IGRlY291cGxlKGRvYywgXCJzY3JvbGxcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICBpZiAoIXNlbGYuX21vdmVkKSB7XHJcbiAgICAgIGNsZWFyVGltZW91dChzY3JvbGxUaW1lb3V0KTtcclxuICAgICAgc2Nyb2xsaW5nID0gdHJ1ZTtcclxuICAgICAgc2Nyb2xsVGltZW91dCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgc2Nyb2xsaW5nID0gZmFsc2U7XHJcbiAgICAgIH0sIDI1MCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIC8qKlxyXG4gICAqIFByZXZlbnRzIHRvdWNobW92ZSBldmVudCBpZiBzbGlkZW91dCBpcyBtb3ZpbmdcclxuICAgKi9cclxuICB0aGlzLl9wcmV2ZW50TW92ZSA9IGZ1bmN0aW9uKGV2ZSkge1xyXG4gICAgaWYgKHNlbGYuX21vdmVkKSB7XHJcbiAgICAgIGV2ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIGRvYy5hZGRFdmVudExpc3RlbmVyKHRvdWNoLm1vdmUsIHRoaXMuX3ByZXZlbnRNb3ZlKTtcclxuXHJcbiAgLyoqXHJcbiAgICogUmVzZXRzIHZhbHVlcyBvbiB0b3VjaHN0YXJ0XHJcbiAgICovXHJcbiAgdGhpcy5fcmVzZXRUb3VjaEZuID0gZnVuY3Rpb24oZXZlKSB7XHJcbiAgICBpZiAodHlwZW9mIGV2ZS50b3VjaGVzID09PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9tb3ZlZCA9IGZhbHNlO1xyXG4gICAgc2VsZi5fb3BlbmluZyA9IGZhbHNlO1xyXG4gICAgc2VsZi5fc3RhcnRPZmZzZXRYID0gZXZlLnRvdWNoZXNbMF0ucGFnZVg7XHJcbiAgICBzZWxmLl9wcmV2ZW50T3BlbiA9ICFzZWxmLl90b3VjaCB8fCAoIXNlbGYuaXNPcGVuKCkgJiYgc2VsZi5tZW51LmNsaWVudFdpZHRoICE9PSAwKTtcclxuICB9O1xyXG5cclxuICB0aGlzLnBhbmVsLmFkZEV2ZW50TGlzdGVuZXIodG91Y2guc3RhcnQsIHRoaXMuX3Jlc2V0VG91Y2hGbik7XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc2V0cyB2YWx1ZXMgb24gdG91Y2hjYW5jZWxcclxuICAgKi9cclxuICB0aGlzLl9vblRvdWNoQ2FuY2VsRm4gPSBmdW5jdGlvbigpIHtcclxuICAgIHNlbGYuX21vdmVkID0gZmFsc2U7XHJcbiAgICBzZWxmLl9vcGVuaW5nID0gZmFsc2U7XHJcbiAgfTtcclxuXHJcbiAgdGhpcy5wYW5lbC5hZGRFdmVudExpc3RlbmVyKFwidG91Y2hjYW5jZWxcIiwgdGhpcy5fb25Ub3VjaENhbmNlbEZuKTtcclxuXHJcbiAgLyoqXHJcbiAgICogVG9nZ2xlcyBzbGlkZW91dCBvbiB0b3VjaGVuZFxyXG4gICAqL1xyXG4gIHRoaXMuX29uVG91Y2hFbmRGbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYgKHNlbGYuX21vdmVkKSB7XHJcbiAgICAgIHNlbGYuZW1pdChcInRyYW5zbGF0ZWVuZFwiKTtcclxuICAgICAgc2VsZi5fb3BlbmluZyAmJiBNYXRoLmFicyhzZWxmLl9jdXJyZW50T2Zmc2V0WCkgPiBzZWxmLl90b2xlcmFuY2UgPyBzZWxmLm9wZW4oKSA6IHNlbGYuY2xvc2UoKTtcclxuICAgIH1cclxuICAgIHNlbGYuX21vdmVkID0gZmFsc2U7XHJcbiAgfTtcclxuXHJcbiAgdGhpcy5wYW5lbC5hZGRFdmVudExpc3RlbmVyKHRvdWNoLmVuZCwgdGhpcy5fb25Ub3VjaEVuZEZuKTtcclxuXHJcbiAgLyoqXHJcbiAgICogVHJhbnNsYXRlcyBwYW5lbCBvbiB0b3VjaG1vdmVcclxuICAgKi9cclxuICB0aGlzLl9vblRvdWNoTW92ZUZuID0gZnVuY3Rpb24oZXZlKSB7XHJcbiAgICBpZiAoc2Nyb2xsaW5nIHx8IHNlbGYuX3ByZXZlbnRPcGVuIHx8IHR5cGVvZiBldmUudG91Y2hlcyA9PT0gXCJ1bmRlZmluZWRcIiB8fCBoYXNJZ25vcmVkRWxlbWVudHMoZXZlLnRhcmdldCkpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBkaWZfeCA9IGV2ZS50b3VjaGVzWzBdLmNsaWVudFggLSBzZWxmLl9zdGFydE9mZnNldFg7XHJcbiAgICB2YXIgdHJhbnNsYXRlWCA9IChzZWxmLl9jdXJyZW50T2Zmc2V0WCA9IGRpZl94KTtcclxuXHJcbiAgICBpZiAoTWF0aC5hYnModHJhbnNsYXRlWCkgPiBzZWxmLl9wYWRkaW5nKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoTWF0aC5hYnMoZGlmX3gpID4gMjApIHtcclxuICAgICAgc2VsZi5fb3BlbmluZyA9IHRydWU7XHJcblxyXG4gICAgICB2YXIgb3JpZW50ZWRfZGlmX3ggPSBkaWZfeCAqIHNlbGYuX29yaWVudGF0aW9uO1xyXG5cclxuICAgICAgaWYgKChzZWxmLl9vcGVuZWQgJiYgb3JpZW50ZWRfZGlmX3ggPiAwKSB8fCAoIXNlbGYuX29wZW5lZCAmJiBvcmllbnRlZF9kaWZfeCA8IDApKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoIXNlbGYuX21vdmVkKSB7XHJcbiAgICAgICAgc2VsZi5lbWl0KFwidHJhbnNsYXRlc3RhcnRcIik7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChvcmllbnRlZF9kaWZfeCA8PSAwKSB7XHJcbiAgICAgICAgdHJhbnNsYXRlWCA9IGRpZl94ICsgc2VsZi5fcGFkZGluZyAqIHNlbGYuX29yaWVudGF0aW9uO1xyXG4gICAgICAgIHNlbGYuX29wZW5pbmcgPSBmYWxzZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKCEoc2VsZi5fbW92ZWQgJiYgaHRtbC5jbGFzc0xpc3QuY29udGFpbnMoXCJzbGlkZW91dC1vcGVuXCIpKSkge1xyXG4gICAgICAgIGh0bWwuY2xhc3NMaXN0LmFkZChcInNsaWRlb3V0LW9wZW5cIik7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHNlbGYucGFuZWwuc3R5bGVbcHJlZml4ICsgXCJ0cmFuc2Zvcm1cIl0gPSBzZWxmLnBhbmVsLnN0eWxlLnRyYW5zZm9ybSA9IFwidHJhbnNsYXRlWChcIiArIHRyYW5zbGF0ZVggKyBcInB4KVwiO1xyXG4gICAgICBzZWxmLmVtaXQoXCJ0cmFuc2xhdGVcIiwgdHJhbnNsYXRlWCk7XHJcbiAgICAgIHNlbGYuX21vdmVkID0gdHJ1ZTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICB0aGlzLnBhbmVsLmFkZEV2ZW50TGlzdGVuZXIodG91Y2gubW92ZSwgdGhpcy5fb25Ub3VjaE1vdmVGbik7XHJcblxyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEVuYWJsZSBvcGVuaW5nIHRoZSBzbGlkZW91dCB2aWEgdG91Y2ggZXZlbnRzLlxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLmVuYWJsZVRvdWNoID0gZnVuY3Rpb24oKSB7XHJcbiAgdGhpcy5fdG91Y2ggPSB0cnVlO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIERpc2FibGUgb3BlbmluZyB0aGUgc2xpZGVvdXQgdmlhIHRvdWNoIGV2ZW50cy5cclxuICovXHJcblNsaWRlb3V0LnByb3RvdHlwZS5kaXNhYmxlVG91Y2ggPSBmdW5jdGlvbigpIHtcclxuICB0aGlzLl90b3VjaCA9IGZhbHNlO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIERlc3Ryb3kgYW4gaW5zdGFuY2Ugb2Ygc2xpZGVvdXQuXHJcbiAqL1xyXG5TbGlkZW91dC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xyXG4gIC8vIENsb3NlIGJlZm9yZSBjbGVhblxyXG4gIHRoaXMuY2xvc2UoKTtcclxuXHJcbiAgLy8gUmVtb3ZlIGV2ZW50IGxpc3RlbmVyc1xyXG4gIGRvYy5yZW1vdmVFdmVudExpc3RlbmVyKHRvdWNoLm1vdmUsIHRoaXMuX3ByZXZlbnRNb3ZlKTtcclxuICB0aGlzLnBhbmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodG91Y2guc3RhcnQsIHRoaXMuX3Jlc2V0VG91Y2hGbik7XHJcbiAgdGhpcy5wYW5lbC5yZW1vdmVFdmVudExpc3RlbmVyKFwidG91Y2hjYW5jZWxcIiwgdGhpcy5fb25Ub3VjaENhbmNlbEZuKTtcclxuICB0aGlzLnBhbmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodG91Y2guZW5kLCB0aGlzLl9vblRvdWNoRW5kRm4pO1xyXG4gIHRoaXMucGFuZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcih0b3VjaC5tb3ZlLCB0aGlzLl9vblRvdWNoTW92ZUZuKTtcclxuICBkb2MucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInNjcm9sbFwiLCB0aGlzLl9vblNjcm9sbEZuKTtcclxuXHJcbiAgLy8gUmVtb3ZlIG1ldGhvZHNcclxuICB0aGlzLm9wZW4gPSB0aGlzLmNsb3NlID0gZnVuY3Rpb24oKSB7fTtcclxuXHJcbiAgLy8gUmV0dXJuIHRoZSBpbnN0YW5jZSBzbyBpdCBjYW4gYmUgZWFzaWx5IGRlcmVmZXJlbmNlZFxyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEV4cG9zZSBTbGlkZW91dFxyXG4gKi9cclxubW9kdWxlLmV4cG9ydHMgPSBTbGlkZW91dDtcclxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmVxdWVzdEFuaW1GcmFtZSA9IChmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICB3aW5kb3cud2Via2l0UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XG4gICAgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICB3aW5kb3cuc2V0VGltZW91dChjYWxsYmFjaywgMTAwMCAvIDYwKTtcbiAgICB9O1xufSgpKTtcblxuZnVuY3Rpb24gZGVjb3VwbGUobm9kZSwgZXZlbnQsIGZuKSB7XG4gIHZhciBldmUsXG4gICAgICB0cmFja2luZyA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGNhcHR1cmVFdmVudChlKSB7XG4gICAgZXZlID0gZTtcbiAgICB0cmFjaygpO1xuICB9XG5cbiAgZnVuY3Rpb24gdHJhY2soKSB7XG4gICAgaWYgKCF0cmFja2luZykge1xuICAgICAgcmVxdWVzdEFuaW1GcmFtZSh1cGRhdGUpO1xuICAgICAgdHJhY2tpbmcgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZSgpIHtcbiAgICBmbi5jYWxsKG5vZGUsIGV2ZSk7XG4gICAgdHJhY2tpbmcgPSBmYWxzZTtcbiAgfVxuXG4gIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgY2FwdHVyZUV2ZW50LCBmYWxzZSk7XG5cbiAgcmV0dXJuIGNhcHR1cmVFdmVudDtcbn1cblxuLyoqXG4gKiBFeHBvc2UgZGVjb3VwbGVcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBkZWNvdXBsZTtcbiIsIlwidXNlIHN0cmljdFwiO1xyXG5cclxudmFyIF9jbGFzc0NhbGxDaGVjayA9IGZ1bmN0aW9uIChpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvblwiKTsgfSB9O1xyXG5cclxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcclxuLyoqXHJcbiAqIENyZWF0ZXMgYSBuZXcgaW5zdGFuY2Ugb2YgRW1pdHRlci5cclxuICogQGNsYXNzXHJcbiAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYSBuZXcgaW5zdGFuY2Ugb2YgRW1pdHRlci5cclxuICogQGV4YW1wbGVcclxuICogLy8gQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gKiB2YXIgRW1pdHRlciA9IHJlcXVpcmUoJ2VtaXR0ZXInKTtcclxuICpcclxuICogdmFyIGVtaXR0ZXIgPSBuZXcgRW1pdHRlcigpO1xyXG4gKi9cclxuXHJcbnZhciBFbWl0dGVyID0gKGZ1bmN0aW9uICgpIHtcclxuICBmdW5jdGlvbiBFbWl0dGVyKCkge1xyXG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEVtaXR0ZXIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhIGxpc3RlbmVyIHRvIHRoZSBjb2xsZWN0aW9uIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50LlxyXG4gICAqIEBtZW1iZXJvZiEgRW1pdHRlci5wcm90b3R5cGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSBUaGUgZXZlbnQgbmFtZS5cclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciAtIEEgbGlzdGVuZXIgZnVuY3Rpb24gdG8gYWRkLlxyXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgRW1pdHRlci5cclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIEFkZCBhbiBldmVudCBsaXN0ZW5lciB0byBcImZvb1wiIGV2ZW50LlxyXG4gICAqIGVtaXR0ZXIub24oJ2ZvbycsIGxpc3RlbmVyKTtcclxuICAgKi9cclxuXHJcbiAgRW1pdHRlci5wcm90b3R5cGUub24gPSBmdW5jdGlvbiBvbihldmVudCwgbGlzdGVuZXIpIHtcclxuICAgIC8vIFVzZSB0aGUgY3VycmVudCBjb2xsZWN0aW9uIG9yIGNyZWF0ZSBpdC5cclxuICAgIHRoaXMuX2V2ZW50Q29sbGVjdGlvbiA9IHRoaXMuX2V2ZW50Q29sbGVjdGlvbiB8fCB7fTtcclxuXHJcbiAgICAvLyBVc2UgdGhlIGN1cnJlbnQgY29sbGVjdGlvbiBvZiBhbiBldmVudCBvciBjcmVhdGUgaXQuXHJcbiAgICB0aGlzLl9ldmVudENvbGxlY3Rpb25bZXZlbnRdID0gdGhpcy5fZXZlbnRDb2xsZWN0aW9uW2V2ZW50XSB8fCBbXTtcclxuXHJcbiAgICAvLyBBcHBlbmRzIHRoZSBsaXN0ZW5lciBpbnRvIHRoZSBjb2xsZWN0aW9uIG9mIHRoZSBnaXZlbiBldmVudFxyXG4gICAgdGhpcy5fZXZlbnRDb2xsZWN0aW9uW2V2ZW50XS5wdXNoKGxpc3RlbmVyKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGEgbGlzdGVuZXIgdG8gdGhlIGNvbGxlY3Rpb24gZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnQgdGhhdCB3aWxsIGJlIGNhbGxlZCBvbmx5IG9uY2UuXHJcbiAgICogQG1lbWJlcm9mISBFbWl0dGVyLnByb3RvdHlwZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIC0gQSBsaXN0ZW5lciBmdW5jdGlvbiB0byBhZGQuXHJcbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gV2lsbCBhZGQgYW4gZXZlbnQgaGFuZGxlciB0byBcImZvb1wiIGV2ZW50IG9uY2UuXHJcbiAgICogZW1pdHRlci5vbmNlKCdmb28nLCBsaXN0ZW5lcik7XHJcbiAgICovXHJcblxyXG4gIEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbiBvbmNlKGV2ZW50LCBsaXN0ZW5lcikge1xyXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAgIGZ1bmN0aW9uIGZuKCkge1xyXG4gICAgICBzZWxmLm9mZihldmVudCwgZm4pO1xyXG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZuLmxpc3RlbmVyID0gbGlzdGVuZXI7XHJcblxyXG4gICAgdGhpcy5vbihldmVudCwgZm4pO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZXMgYSBsaXN0ZW5lciBmcm9tIHRoZSBjb2xsZWN0aW9uIGZvciB0aGUgc3BlY2lmaWVkIGV2ZW50LlxyXG4gICAqIEBtZW1iZXJvZiEgRW1pdHRlci5wcm90b3R5cGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSBUaGUgZXZlbnQgbmFtZS5cclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciAtIEEgbGlzdGVuZXIgZnVuY3Rpb24gdG8gcmVtb3ZlLlxyXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgRW1pdHRlci5cclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIFJlbW92ZSBhIGdpdmVuIGxpc3RlbmVyLlxyXG4gICAqIGVtaXR0ZXIub2ZmKCdmb28nLCBsaXN0ZW5lcik7XHJcbiAgICovXHJcblxyXG4gIEVtaXR0ZXIucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uIG9mZihldmVudCwgbGlzdGVuZXIpIHtcclxuXHJcbiAgICB2YXIgbGlzdGVuZXJzID0gdW5kZWZpbmVkO1xyXG5cclxuICAgIC8vIERlZmluZXMgbGlzdGVuZXJzIHZhbHVlLlxyXG4gICAgaWYgKCF0aGlzLl9ldmVudENvbGxlY3Rpb24gfHwgIShsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudENvbGxlY3Rpb25bZXZlbnRdKSkge1xyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBsaXN0ZW5lcnMuZm9yRWFjaChmdW5jdGlvbiAoZm4sIGkpIHtcclxuICAgICAgaWYgKGZuID09PSBsaXN0ZW5lciB8fCBmbi5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcclxuICAgICAgICAvLyBSZW1vdmVzIHRoZSBnaXZlbiBsaXN0ZW5lci5cclxuICAgICAgICBsaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBSZW1vdmVzIGFuIGVtcHR5IGV2ZW50IGNvbGxlY3Rpb24uXHJcbiAgICBpZiAobGlzdGVuZXJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRDb2xsZWN0aW9uW2V2ZW50XTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBFeGVjdXRlIGVhY2ggaXRlbSBpbiB0aGUgbGlzdGVuZXIgY29sbGVjdGlvbiBpbiBvcmRlciB3aXRoIHRoZSBzcGVjaWZpZWQgZGF0YS5cclxuICAgKiBAbWVtYmVyb2YhIEVtaXR0ZXIucHJvdG90eXBlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0gVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHlvdSB3YW50IHRvIGVtaXQuXHJcbiAgICogQHBhcmFtIHsuLi5PYmplY3R9IGRhdGEgLSBEYXRhIHRvIHBhc3MgdG8gdGhlIGxpc3RlbmVycy5cclxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIEVtaXR0ZXIuXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiAvLyBFbWl0cyB0aGUgXCJmb29cIiBldmVudCB3aXRoICdwYXJhbTEnIGFuZCAncGFyYW0yJyBhcyBhcmd1bWVudHMuXHJcbiAgICogZW1pdHRlci5lbWl0KCdmb28nLCAncGFyYW0xJywgJ3BhcmFtMicpO1xyXG4gICAqL1xyXG5cclxuICBFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24gZW1pdChldmVudCkge1xyXG4gICAgdmFyIF90aGlzID0gdGhpcztcclxuXHJcbiAgICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IEFycmF5KF9sZW4gPiAxID8gX2xlbiAtIDEgOiAwKSwgX2tleSA9IDE7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcclxuICAgICAgYXJnc1tfa2V5IC0gMV0gPSBhcmd1bWVudHNbX2tleV07XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGxpc3RlbmVycyA9IHVuZGVmaW5lZDtcclxuXHJcbiAgICAvLyBEZWZpbmVzIGxpc3RlbmVycyB2YWx1ZS5cclxuICAgIGlmICghdGhpcy5fZXZlbnRDb2xsZWN0aW9uIHx8ICEobGlzdGVuZXJzID0gdGhpcy5fZXZlbnRDb2xsZWN0aW9uW2V2ZW50XSkpIHtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQ2xvbmUgbGlzdGVuZXJzXHJcbiAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuc2xpY2UoMCk7XHJcblxyXG4gICAgbGlzdGVuZXJzLmZvckVhY2goZnVuY3Rpb24gKGZuKSB7XHJcbiAgICAgIHJldHVybiBmbi5hcHBseShfdGhpcywgYXJncyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9O1xyXG5cclxuICByZXR1cm4gRW1pdHRlcjtcclxufSkoKTtcclxuXHJcbi8qKlxyXG4gKiBFeHBvcnRzIEVtaXR0ZXJcclxuICovXHJcbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gRW1pdHRlcjtcclxubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzW1wiZGVmYXVsdFwiXTsiXX0=
