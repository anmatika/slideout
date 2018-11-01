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
  this._duration = parseInt(options.duration, 10) || 300;
  this._tolerance = parseInt(options.tolerance, 10) || 70;
  var padding = parseInt(options.padding, 10);
  this._padding = this._translateTo = padding === undefined ? 256 : padding;
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kZWNvdXBsZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lbWl0dGVyL2Rpc3QvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIlwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXNcclxuICovXHJcbnZhciBkZWNvdXBsZSA9IHJlcXVpcmUoXCJkZWNvdXBsZVwiKTtcclxudmFyIEVtaXR0ZXIgPSByZXF1aXJlKFwiZW1pdHRlclwiKTtcclxuXHJcbi8qKlxyXG4gKiBQcml2YXRlc1xyXG4gKi9cclxudmFyIHNjcm9sbFRpbWVvdXQ7XHJcbnZhciBzY3JvbGxpbmcgPSBmYWxzZTtcclxudmFyIGRvYyA9IHdpbmRvdy5kb2N1bWVudDtcclxudmFyIGh0bWwgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xyXG52YXIgbXNQb2ludGVyU3VwcG9ydGVkID0gd2luZG93Lm5hdmlnYXRvci5tc1BvaW50ZXJFbmFibGVkO1xyXG52YXIgdG91Y2ggPSB7XHJcbiAgc3RhcnQ6IG1zUG9pbnRlclN1cHBvcnRlZCA/IFwiTVNQb2ludGVyRG93blwiIDogXCJ0b3VjaHN0YXJ0XCIsXHJcbiAgbW92ZTogbXNQb2ludGVyU3VwcG9ydGVkID8gXCJNU1BvaW50ZXJNb3ZlXCIgOiBcInRvdWNobW92ZVwiLFxyXG4gIGVuZDogbXNQb2ludGVyU3VwcG9ydGVkID8gXCJNU1BvaW50ZXJVcFwiIDogXCJ0b3VjaGVuZFwiLFxyXG59O1xyXG52YXIgcHJlZml4ID0gKGZ1bmN0aW9uIHByZWZpeCgpIHtcclxuICB2YXIgcmVnZXggPSAvXihXZWJraXR8S2h0bWx8TW96fG1zfE8pKD89W0EtWl0pLztcclxuICB2YXIgc3R5bGVEZWNsYXJhdGlvbiA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcInNjcmlwdFwiKVswXS5zdHlsZTtcclxuICBmb3IgKHZhciBwcm9wIGluIHN0eWxlRGVjbGFyYXRpb24pIHtcclxuICAgIGlmIChyZWdleC50ZXN0KHByb3ApKSB7XHJcbiAgICAgIHJldHVybiBcIi1cIiArIHByb3AubWF0Y2gocmVnZXgpWzBdLnRvTG93ZXJDYXNlKCkgKyBcIi1cIjtcclxuICAgIH1cclxuICB9XHJcbiAgLy8gTm90aGluZyBmb3VuZCBzbyBmYXI/IFdlYmtpdCBkb2VzIG5vdCBlbnVtZXJhdGUgb3ZlciB0aGUgQ1NTIHByb3BlcnRpZXMgb2YgdGhlIHN0eWxlIG9iamVjdC5cclxuICAvLyBIb3dldmVyIChwcm9wIGluIHN0eWxlKSByZXR1cm5zIHRoZSBjb3JyZWN0IHZhbHVlLCBzbyB3ZSdsbCBoYXZlIHRvIHRlc3QgZm9yXHJcbiAgLy8gdGhlIHByZWNlbmNlIG9mIGEgc3BlY2lmaWMgcHJvcGVydHlcclxuICBpZiAoXCJXZWJraXRPcGFjaXR5XCIgaW4gc3R5bGVEZWNsYXJhdGlvbikge1xyXG4gICAgcmV0dXJuIFwiLXdlYmtpdC1cIjtcclxuICB9XHJcbiAgaWYgKFwiS2h0bWxPcGFjaXR5XCIgaW4gc3R5bGVEZWNsYXJhdGlvbikge1xyXG4gICAgcmV0dXJuIFwiLWtodG1sLVwiO1xyXG4gIH1cclxuICByZXR1cm4gXCJcIjtcclxufSkoKTtcclxuZnVuY3Rpb24gZXh0ZW5kKGRlc3RpbmF0aW9uLCBmcm9tKSB7XHJcbiAgZm9yICh2YXIgcHJvcCBpbiBmcm9tKSB7XHJcbiAgICBpZiAoZnJvbVtwcm9wXSkge1xyXG4gICAgICBkZXN0aW5hdGlvbltwcm9wXSA9IGZyb21bcHJvcF07XHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBkZXN0aW5hdGlvbjtcclxufVxyXG5mdW5jdGlvbiBpbmhlcml0cyhjaGlsZCwgdWJlcikge1xyXG4gIGNoaWxkLnByb3RvdHlwZSA9IGV4dGVuZChjaGlsZC5wcm90b3R5cGUgfHwge30sIHViZXIucHJvdG90eXBlKTtcclxufVxyXG5mdW5jdGlvbiBoYXNJZ25vcmVkRWxlbWVudHMoZWwpIHtcclxuICB3aGlsZSAoZWwucGFyZW50Tm9kZSkge1xyXG4gICAgaWYgKGVsLmdldEF0dHJpYnV0ZShcImRhdGEtc2xpZGVvdXQtaWdub3JlXCIpICE9PSBudWxsKSB7XHJcbiAgICAgIHJldHVybiBlbDtcclxuICAgIH1cclxuICAgIGVsID0gZWwucGFyZW50Tm9kZTtcclxuICB9XHJcbiAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTbGlkZW91dCBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gU2xpZGVvdXQob3B0aW9ucykge1xyXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG5cclxuICAvLyBTZXRzIGRlZmF1bHQgdmFsdWVzXHJcbiAgdGhpcy5fc3RhcnRPZmZzZXRYID0gMDtcclxuICB0aGlzLl9jdXJyZW50T2Zmc2V0WCA9IDA7XHJcbiAgdGhpcy5fb3BlbmluZyA9IGZhbHNlO1xyXG4gIHRoaXMuX21vdmVkID0gZmFsc2U7XHJcbiAgdGhpcy5fb3BlbmVkID0gZmFsc2U7XHJcbiAgdGhpcy5fcHJldmVudE9wZW4gPSBmYWxzZTtcclxuXHJcbiAgLy8gU2V0cyBwYW5lbFxyXG4gIHRoaXMucGFuZWwgPSBvcHRpb25zLnBhbmVsO1xyXG4gIHRoaXMubWVudSA9IG9wdGlvbnMubWVudTtcclxuXHJcbiAgLy8gU2V0cyBvcHRpb25zXHJcbiAgdGhpcy5fdG91Y2ggPSBvcHRpb25zLnRvdWNoID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0aW9ucy50b3VjaCAmJiB0cnVlO1xyXG4gIHRoaXMuX3NpZGUgPSBvcHRpb25zLnNpZGUgfHwgXCJsZWZ0XCI7XHJcbiAgdGhpcy5fZWFzaW5nID0gb3B0aW9ucy5meCB8fCBvcHRpb25zLmVhc2luZyB8fCBcImVhc2VcIjtcclxuICB0aGlzLl9kdXJhdGlvbiA9IHBhcnNlSW50KG9wdGlvbnMuZHVyYXRpb24sIDEwKSB8fCAzMDA7XHJcbiAgdGhpcy5fdG9sZXJhbmNlID0gcGFyc2VJbnQob3B0aW9ucy50b2xlcmFuY2UsIDEwKSB8fCA3MDtcclxuICB2YXIgcGFkZGluZyA9IHBhcnNlSW50KG9wdGlvbnMucGFkZGluZywgMTApO1xyXG4gIHRoaXMuX3BhZGRpbmcgPSB0aGlzLl90cmFuc2xhdGVUbyA9IHBhZGRpbmcgPT09IHVuZGVmaW5lZCA/IDI1NiA6IHBhZGRpbmc7XHJcbiAgdGhpcy5fb3JpZW50YXRpb24gPSB0aGlzLl9zaWRlID09PSBcInJpZ2h0XCIgPyAtMSA6IDE7XHJcbiAgdGhpcy5fdHJhbnNsYXRlVG8gKj0gdGhpcy5fb3JpZW50YXRpb247XHJcblxyXG4gIC8vIFNldHMgIGNsYXNzbmFtZXNcclxuICBpZiAoIXRoaXMucGFuZWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwic2xpZGVvdXQtcGFuZWxcIikpIHtcclxuICAgIHRoaXMucGFuZWwuY2xhc3NMaXN0LmFkZChcInNsaWRlb3V0LXBhbmVsXCIpO1xyXG4gIH1cclxuICBpZiAoIXRoaXMucGFuZWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwic2xpZGVvdXQtcGFuZWwtXCIgKyB0aGlzLl9zaWRlKSkge1xyXG4gICAgdGhpcy5wYW5lbC5jbGFzc0xpc3QuYWRkKFwic2xpZGVvdXQtcGFuZWwtXCIgKyB0aGlzLl9zaWRlKTtcclxuICB9XHJcbiAgaWYgKCF0aGlzLm1lbnUuY2xhc3NMaXN0LmNvbnRhaW5zKFwic2xpZGVvdXQtbWVudVwiKSkge1xyXG4gICAgdGhpcy5tZW51LmNsYXNzTGlzdC5hZGQoXCJzbGlkZW91dC1tZW51XCIpO1xyXG4gIH1cclxuICBpZiAoIXRoaXMubWVudS5jbGFzc0xpc3QuY29udGFpbnMoXCJzbGlkZW91dC1tZW51LVwiICsgdGhpcy5fc2lkZSkpIHtcclxuICAgIHRoaXMubWVudS5jbGFzc0xpc3QuYWRkKFwic2xpZGVvdXQtbWVudS1cIiArIHRoaXMuX3NpZGUpO1xyXG4gIH1cclxuXHJcbiAgLy8gSW5pdCB0b3VjaCBldmVudHNcclxuICBpZiAodGhpcy5fdG91Y2gpIHtcclxuICAgIHRoaXMuX2luaXRUb3VjaEV2ZW50cygpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEluaGVyaXRzIGZyb20gRW1pdHRlclxyXG4gKi9cclxuaW5oZXJpdHMoU2xpZGVvdXQsIEVtaXR0ZXIpO1xyXG5cclxuLyoqXHJcbiAqIE9wZW5zIHRoZSBzbGlkZW91dCBtZW51LlxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLm9wZW4gPSBmdW5jdGlvbigpIHtcclxuICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgdGhpcy5lbWl0KFwiYmVmb3Jlb3BlblwiKTtcclxuICBpZiAoIWh0bWwuY2xhc3NMaXN0LmNvbnRhaW5zKFwic2xpZGVvdXQtb3BlblwiKSkge1xyXG4gICAgaHRtbC5jbGFzc0xpc3QuYWRkKFwic2xpZGVvdXQtb3BlblwiKTtcclxuICB9XHJcbiAgdGhpcy5fc2V0VHJhbnNpdGlvbigpO1xyXG4gIHRoaXMuX3RyYW5zbGF0ZVhUbyh0aGlzLl90cmFuc2xhdGVUbyk7XHJcbiAgdGhpcy5fb3BlbmVkID0gdHJ1ZTtcclxuICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgc2VsZi5wYW5lbC5zdHlsZS50cmFuc2l0aW9uID0gc2VsZi5wYW5lbC5zdHlsZVtcIi13ZWJraXQtdHJhbnNpdGlvblwiXSA9IFwiXCI7XHJcbiAgICBzZWxmLmVtaXQoXCJvcGVuXCIpO1xyXG4gIH0sIHRoaXMuX2R1cmF0aW9uICsgNTApO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENsb3NlcyBzbGlkZW91dCBtZW51LlxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gIGlmICghdGhpcy5pc09wZW4oKSAmJiAhdGhpcy5fb3BlbmluZykge1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG4gIHRoaXMuZW1pdChcImJlZm9yZWNsb3NlXCIpO1xyXG4gIHRoaXMuX3NldFRyYW5zaXRpb24oKTtcclxuICB0aGlzLl90cmFuc2xhdGVYVG8oMCk7XHJcbiAgdGhpcy5fb3BlbmVkID0gZmFsc2U7XHJcbiAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgIGh0bWwuY2xhc3NMaXN0LnJlbW92ZShcInNsaWRlb3V0LW9wZW5cIik7XHJcbiAgICBzZWxmLnBhbmVsLnN0eWxlLnRyYW5zaXRpb24gPSBzZWxmLnBhbmVsLnN0eWxlW1wiLXdlYmtpdC10cmFuc2l0aW9uXCJdID0gc2VsZi5wYW5lbC5zdHlsZVtcclxuICAgICAgcHJlZml4ICsgXCJ0cmFuc2Zvcm1cIlxyXG4gICAgXSA9IHNlbGYucGFuZWwuc3R5bGUudHJhbnNmb3JtID0gXCJcIjtcclxuICAgIHNlbGYuZW1pdChcImNsb3NlXCIpO1xyXG4gIH0sIHRoaXMuX2R1cmF0aW9uICsgNTApO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFRvZ2dsZXMgKG9wZW4vY2xvc2UpIHNsaWRlb3V0IG1lbnUuXHJcbiAqL1xyXG5TbGlkZW91dC5wcm90b3R5cGUudG9nZ2xlID0gZnVuY3Rpb24oKSB7XHJcbiAgcmV0dXJuIHRoaXMuaXNPcGVuKCkgPyB0aGlzLmNsb3NlKCkgOiB0aGlzLm9wZW4oKTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNsaWRlb3V0IGlzIGN1cnJlbnRseSBvcGVuLCBhbmQgZmFsc2UgaWYgaXQgaXMgY2xvc2VkLlxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLmlzT3BlbiA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiB0aGlzLl9vcGVuZWQ7XHJcbn07XHJcblxyXG4vKipcclxuICogVHJhbnNsYXRlcyBwYW5lbCBhbmQgdXBkYXRlcyBjdXJyZW50T2Zmc2V0IHdpdGggYSBnaXZlbiBYIHBvaW50XHJcbiAqL1xyXG5TbGlkZW91dC5wcm90b3R5cGUuX3RyYW5zbGF0ZVhUbyA9IGZ1bmN0aW9uKHRyYW5zbGF0ZVgpIHtcclxuICB0aGlzLl9jdXJyZW50T2Zmc2V0WCA9IHRyYW5zbGF0ZVg7XHJcbiAgdGhpcy5wYW5lbC5zdHlsZVtwcmVmaXggKyBcInRyYW5zZm9ybVwiXSA9IHRoaXMucGFuZWwuc3R5bGUudHJhbnNmb3JtID0gXCJ0cmFuc2xhdGVYKFwiICsgdHJhbnNsYXRlWCArIFwicHgpXCI7XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogU2V0IHRyYW5zaXRpb24gcHJvcGVydGllc1xyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLl9zZXRUcmFuc2l0aW9uID0gZnVuY3Rpb24oKSB7XHJcbiAgdGhpcy5wYW5lbC5zdHlsZVtwcmVmaXggKyBcInRyYW5zaXRpb25cIl0gPSB0aGlzLnBhbmVsLnN0eWxlLnRyYW5zaXRpb24gPVxyXG4gICAgcHJlZml4ICsgXCJ0cmFuc2Zvcm0gXCIgKyB0aGlzLl9kdXJhdGlvbiArIFwibXMgXCIgKyB0aGlzLl9lYXNpbmc7XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogSW5pdGlhbGl6ZXMgdG91Y2ggZXZlbnRcclxuICovXHJcblNsaWRlb3V0LnByb3RvdHlwZS5faW5pdFRvdWNoRXZlbnRzID0gZnVuY3Rpb24oKSB7XHJcbiAgdmFyIHNlbGYgPSB0aGlzO1xyXG5cclxuICAvKipcclxuICAgKiBEZWNvdXBsZSBzY3JvbGwgZXZlbnRcclxuICAgKi9cclxuICB0aGlzLl9vblNjcm9sbEZuID0gZGVjb3VwbGUoZG9jLCBcInNjcm9sbFwiLCBmdW5jdGlvbigpIHtcclxuICAgIGlmICghc2VsZi5fbW92ZWQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHNjcm9sbFRpbWVvdXQpO1xyXG4gICAgICBzY3JvbGxpbmcgPSB0cnVlO1xyXG4gICAgICBzY3JvbGxUaW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICBzY3JvbGxpbmcgPSBmYWxzZTtcclxuICAgICAgfSwgMjUwKTtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgLyoqXHJcbiAgICogUHJldmVudHMgdG91Y2htb3ZlIGV2ZW50IGlmIHNsaWRlb3V0IGlzIG1vdmluZ1xyXG4gICAqL1xyXG4gIHRoaXMuX3ByZXZlbnRNb3ZlID0gZnVuY3Rpb24oZXZlKSB7XHJcbiAgICBpZiAoc2VsZi5fbW92ZWQpIHtcclxuICAgICAgZXZlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgZG9jLmFkZEV2ZW50TGlzdGVuZXIodG91Y2gubW92ZSwgdGhpcy5fcHJldmVudE1vdmUpO1xyXG5cclxuICAvKipcclxuICAgKiBSZXNldHMgdmFsdWVzIG9uIHRvdWNoc3RhcnRcclxuICAgKi9cclxuICB0aGlzLl9yZXNldFRvdWNoRm4gPSBmdW5jdGlvbihldmUpIHtcclxuICAgIGlmICh0eXBlb2YgZXZlLnRvdWNoZXMgPT09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHNlbGYuX21vdmVkID0gZmFsc2U7XHJcbiAgICBzZWxmLl9vcGVuaW5nID0gZmFsc2U7XHJcbiAgICBzZWxmLl9zdGFydE9mZnNldFggPSBldmUudG91Y2hlc1swXS5wYWdlWDtcclxuICAgIHNlbGYuX3ByZXZlbnRPcGVuID0gIXNlbGYuX3RvdWNoIHx8ICghc2VsZi5pc09wZW4oKSAmJiBzZWxmLm1lbnUuY2xpZW50V2lkdGggIT09IDApO1xyXG4gIH07XHJcblxyXG4gIHRoaXMucGFuZWwuYWRkRXZlbnRMaXN0ZW5lcih0b3VjaC5zdGFydCwgdGhpcy5fcmVzZXRUb3VjaEZuKTtcclxuXHJcbiAgLyoqXHJcbiAgICogUmVzZXRzIHZhbHVlcyBvbiB0b3VjaGNhbmNlbFxyXG4gICAqL1xyXG4gIHRoaXMuX29uVG91Y2hDYW5jZWxGbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgc2VsZi5fbW92ZWQgPSBmYWxzZTtcclxuICAgIHNlbGYuX29wZW5pbmcgPSBmYWxzZTtcclxuICB9O1xyXG5cclxuICB0aGlzLnBhbmVsLmFkZEV2ZW50TGlzdGVuZXIoXCJ0b3VjaGNhbmNlbFwiLCB0aGlzLl9vblRvdWNoQ2FuY2VsRm4pO1xyXG5cclxuICAvKipcclxuICAgKiBUb2dnbGVzIHNsaWRlb3V0IG9uIHRvdWNoZW5kXHJcbiAgICovXHJcbiAgdGhpcy5fb25Ub3VjaEVuZEZuID0gZnVuY3Rpb24oKSB7XHJcbiAgICBpZiAoc2VsZi5fbW92ZWQpIHtcclxuICAgICAgc2VsZi5lbWl0KFwidHJhbnNsYXRlZW5kXCIpO1xyXG4gICAgICBzZWxmLl9vcGVuaW5nICYmIE1hdGguYWJzKHNlbGYuX2N1cnJlbnRPZmZzZXRYKSA+IHNlbGYuX3RvbGVyYW5jZSA/IHNlbGYub3BlbigpIDogc2VsZi5jbG9zZSgpO1xyXG4gICAgfVxyXG4gICAgc2VsZi5fbW92ZWQgPSBmYWxzZTtcclxuICB9O1xyXG5cclxuICB0aGlzLnBhbmVsLmFkZEV2ZW50TGlzdGVuZXIodG91Y2guZW5kLCB0aGlzLl9vblRvdWNoRW5kRm4pO1xyXG5cclxuICAvKipcclxuICAgKiBUcmFuc2xhdGVzIHBhbmVsIG9uIHRvdWNobW92ZVxyXG4gICAqL1xyXG4gIHRoaXMuX29uVG91Y2hNb3ZlRm4gPSBmdW5jdGlvbihldmUpIHtcclxuICAgIGlmIChzY3JvbGxpbmcgfHwgc2VsZi5fcHJldmVudE9wZW4gfHwgdHlwZW9mIGV2ZS50b3VjaGVzID09PSBcInVuZGVmaW5lZFwiIHx8IGhhc0lnbm9yZWRFbGVtZW50cyhldmUudGFyZ2V0KSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGRpZl94ID0gZXZlLnRvdWNoZXNbMF0uY2xpZW50WCAtIHNlbGYuX3N0YXJ0T2Zmc2V0WDtcclxuICAgIHZhciB0cmFuc2xhdGVYID0gKHNlbGYuX2N1cnJlbnRPZmZzZXRYID0gZGlmX3gpO1xyXG5cclxuICAgIGlmIChNYXRoLmFicyh0cmFuc2xhdGVYKSA+IHNlbGYuX3BhZGRpbmcpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChNYXRoLmFicyhkaWZfeCkgPiAyMCkge1xyXG4gICAgICBzZWxmLl9vcGVuaW5nID0gdHJ1ZTtcclxuXHJcbiAgICAgIHZhciBvcmllbnRlZF9kaWZfeCA9IGRpZl94ICogc2VsZi5fb3JpZW50YXRpb247XHJcblxyXG4gICAgICBpZiAoKHNlbGYuX29wZW5lZCAmJiBvcmllbnRlZF9kaWZfeCA+IDApIHx8ICghc2VsZi5fb3BlbmVkICYmIG9yaWVudGVkX2RpZl94IDwgMCkpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICghc2VsZi5fbW92ZWQpIHtcclxuICAgICAgICBzZWxmLmVtaXQoXCJ0cmFuc2xhdGVzdGFydFwiKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKG9yaWVudGVkX2RpZl94IDw9IDApIHtcclxuICAgICAgICB0cmFuc2xhdGVYID0gZGlmX3ggKyBzZWxmLl9wYWRkaW5nICogc2VsZi5fb3JpZW50YXRpb247XHJcbiAgICAgICAgc2VsZi5fb3BlbmluZyA9IGZhbHNlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoIShzZWxmLl9tb3ZlZCAmJiBodG1sLmNsYXNzTGlzdC5jb250YWlucyhcInNsaWRlb3V0LW9wZW5cIikpKSB7XHJcbiAgICAgICAgaHRtbC5jbGFzc0xpc3QuYWRkKFwic2xpZGVvdXQtb3BlblwiKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgc2VsZi5wYW5lbC5zdHlsZVtwcmVmaXggKyBcInRyYW5zZm9ybVwiXSA9IHNlbGYucGFuZWwuc3R5bGUudHJhbnNmb3JtID0gXCJ0cmFuc2xhdGVYKFwiICsgdHJhbnNsYXRlWCArIFwicHgpXCI7XHJcbiAgICAgIHNlbGYuZW1pdChcInRyYW5zbGF0ZVwiLCB0cmFuc2xhdGVYKTtcclxuICAgICAgc2VsZi5fbW92ZWQgPSB0cnVlO1xyXG4gICAgfVxyXG4gIH07XHJcblxyXG4gIHRoaXMucGFuZWwuYWRkRXZlbnRMaXN0ZW5lcih0b3VjaC5tb3ZlLCB0aGlzLl9vblRvdWNoTW92ZUZuKTtcclxuXHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogRW5hYmxlIG9wZW5pbmcgdGhlIHNsaWRlb3V0IHZpYSB0b3VjaCBldmVudHMuXHJcbiAqL1xyXG5TbGlkZW91dC5wcm90b3R5cGUuZW5hYmxlVG91Y2ggPSBmdW5jdGlvbigpIHtcclxuICB0aGlzLl90b3VjaCA9IHRydWU7XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogRGlzYWJsZSBvcGVuaW5nIHRoZSBzbGlkZW91dCB2aWEgdG91Y2ggZXZlbnRzLlxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLmRpc2FibGVUb3VjaCA9IGZ1bmN0aW9uKCkge1xyXG4gIHRoaXMuX3RvdWNoID0gZmFsc2U7XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogRGVzdHJveSBhbiBpbnN0YW5jZSBvZiBzbGlkZW91dC5cclxuICovXHJcblNsaWRlb3V0LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24oKSB7XHJcbiAgLy8gQ2xvc2UgYmVmb3JlIGNsZWFuXHJcbiAgdGhpcy5jbG9zZSgpO1xyXG5cclxuICAvLyBSZW1vdmUgZXZlbnQgbGlzdGVuZXJzXHJcbiAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIodG91Y2gubW92ZSwgdGhpcy5fcHJldmVudE1vdmUpO1xyXG4gIHRoaXMucGFuZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcih0b3VjaC5zdGFydCwgdGhpcy5fcmVzZXRUb3VjaEZuKTtcclxuICB0aGlzLnBhbmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJ0b3VjaGNhbmNlbFwiLCB0aGlzLl9vblRvdWNoQ2FuY2VsRm4pO1xyXG4gIHRoaXMucGFuZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcih0b3VjaC5lbmQsIHRoaXMuX29uVG91Y2hFbmRGbik7XHJcbiAgdGhpcy5wYW5lbC5yZW1vdmVFdmVudExpc3RlbmVyKHRvdWNoLm1vdmUsIHRoaXMuX29uVG91Y2hNb3ZlRm4pO1xyXG4gIGRvYy5yZW1vdmVFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIHRoaXMuX29uU2Nyb2xsRm4pO1xyXG5cclxuICAvLyBSZW1vdmUgbWV0aG9kc1xyXG4gIHRoaXMub3BlbiA9IHRoaXMuY2xvc2UgPSBmdW5jdGlvbigpIHt9O1xyXG5cclxuICAvLyBSZXR1cm4gdGhlIGluc3RhbmNlIHNvIGl0IGNhbiBiZSBlYXNpbHkgZGVyZWZlcmVuY2VkXHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogRXhwb3NlIFNsaWRlb3V0XHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IFNsaWRlb3V0O1xyXG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciByZXF1ZXN0QW5pbUZyYW1lID0gKGZ1bmN0aW9uKCkge1xuICByZXR1cm4gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxuICAgIHdpbmRvdy53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGNhbGxiYWNrLCAxMDAwIC8gNjApO1xuICAgIH07XG59KCkpO1xuXG5mdW5jdGlvbiBkZWNvdXBsZShub2RlLCBldmVudCwgZm4pIHtcbiAgdmFyIGV2ZSxcbiAgICAgIHRyYWNraW5nID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gY2FwdHVyZUV2ZW50KGUpIHtcbiAgICBldmUgPSBlO1xuICAgIHRyYWNrKCk7XG4gIH1cblxuICBmdW5jdGlvbiB0cmFjaygpIHtcbiAgICBpZiAoIXRyYWNraW5nKSB7XG4gICAgICByZXF1ZXN0QW5pbUZyYW1lKHVwZGF0ZSk7XG4gICAgICB0cmFja2luZyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlKCkge1xuICAgIGZuLmNhbGwobm9kZSwgZXZlKTtcbiAgICB0cmFja2luZyA9IGZhbHNlO1xuICB9XG5cbiAgbm9kZS5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBjYXB0dXJlRXZlbnQsIGZhbHNlKTtcblxuICByZXR1cm4gY2FwdHVyZUV2ZW50O1xufVxuXG4vKipcbiAqIEV4cG9zZSBkZWNvdXBsZVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGRlY291cGxlO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgX2NsYXNzQ2FsbENoZWNrID0gZnVuY3Rpb24gKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH07XHJcblxyXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gKiBAY2xhc3NcclxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhIG5ldyBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gKiBAZXhhbXBsZVxyXG4gKiAvLyBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIEVtaXR0ZXIuXHJcbiAqIHZhciBFbWl0dGVyID0gcmVxdWlyZSgnZW1pdHRlcicpO1xyXG4gKlxyXG4gKiB2YXIgZW1pdHRlciA9IG5ldyBFbWl0dGVyKCk7XHJcbiAqL1xyXG5cclxudmFyIEVtaXR0ZXIgPSAoZnVuY3Rpb24gKCkge1xyXG4gIGZ1bmN0aW9uIEVtaXR0ZXIoKSB7XHJcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgRW1pdHRlcik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGEgbGlzdGVuZXIgdG8gdGhlIGNvbGxlY3Rpb24gZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnQuXHJcbiAgICogQG1lbWJlcm9mISBFbWl0dGVyLnByb3RvdHlwZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIC0gQSBsaXN0ZW5lciBmdW5jdGlvbiB0byBhZGQuXHJcbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gQWRkIGFuIGV2ZW50IGxpc3RlbmVyIHRvIFwiZm9vXCIgZXZlbnQuXHJcbiAgICogZW1pdHRlci5vbignZm9vJywgbGlzdGVuZXIpO1xyXG4gICAqL1xyXG5cclxuICBFbWl0dGVyLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uIG9uKGV2ZW50LCBsaXN0ZW5lcikge1xyXG4gICAgLy8gVXNlIHRoZSBjdXJyZW50IGNvbGxlY3Rpb24gb3IgY3JlYXRlIGl0LlxyXG4gICAgdGhpcy5fZXZlbnRDb2xsZWN0aW9uID0gdGhpcy5fZXZlbnRDb2xsZWN0aW9uIHx8IHt9O1xyXG5cclxuICAgIC8vIFVzZSB0aGUgY3VycmVudCBjb2xsZWN0aW9uIG9mIGFuIGV2ZW50IG9yIGNyZWF0ZSBpdC5cclxuICAgIHRoaXMuX2V2ZW50Q29sbGVjdGlvbltldmVudF0gPSB0aGlzLl9ldmVudENvbGxlY3Rpb25bZXZlbnRdIHx8IFtdO1xyXG5cclxuICAgIC8vIEFwcGVuZHMgdGhlIGxpc3RlbmVyIGludG8gdGhlIGNvbGxlY3Rpb24gb2YgdGhlIGdpdmVuIGV2ZW50XHJcbiAgICB0aGlzLl9ldmVudENvbGxlY3Rpb25bZXZlbnRdLnB1c2gobGlzdGVuZXIpO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgYSBsaXN0ZW5lciB0byB0aGUgY29sbGVjdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBldmVudCB0aGF0IHdpbGwgYmUgY2FsbGVkIG9ubHkgb25jZS5cclxuICAgKiBAbWVtYmVyb2YhIEVtaXR0ZXIucHJvdG90eXBlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0gVGhlIGV2ZW50IG5hbWUuXHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgLSBBIGxpc3RlbmVyIGZ1bmN0aW9uIHRvIGFkZC5cclxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIEVtaXR0ZXIuXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiAvLyBXaWxsIGFkZCBhbiBldmVudCBoYW5kbGVyIHRvIFwiZm9vXCIgZXZlbnQgb25jZS5cclxuICAgKiBlbWl0dGVyLm9uY2UoJ2ZvbycsIGxpc3RlbmVyKTtcclxuICAgKi9cclxuXHJcbiAgRW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uIG9uY2UoZXZlbnQsIGxpc3RlbmVyKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgZnVuY3Rpb24gZm4oKSB7XHJcbiAgICAgIHNlbGYub2ZmKGV2ZW50LCBmbik7XHJcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgZm4ubGlzdGVuZXIgPSBsaXN0ZW5lcjtcclxuXHJcbiAgICB0aGlzLm9uKGV2ZW50LCBmbik7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlcyBhIGxpc3RlbmVyIGZyb20gdGhlIGNvbGxlY3Rpb24gZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnQuXHJcbiAgICogQG1lbWJlcm9mISBFbWl0dGVyLnByb3RvdHlwZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIC0gQSBsaXN0ZW5lciBmdW5jdGlvbiB0byByZW1vdmUuXHJcbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gUmVtb3ZlIGEgZ2l2ZW4gbGlzdGVuZXIuXHJcbiAgICogZW1pdHRlci5vZmYoJ2ZvbycsIGxpc3RlbmVyKTtcclxuICAgKi9cclxuXHJcbiAgRW1pdHRlci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24gb2ZmKGV2ZW50LCBsaXN0ZW5lcikge1xyXG5cclxuICAgIHZhciBsaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XHJcblxyXG4gICAgLy8gRGVmaW5lcyBsaXN0ZW5lcnMgdmFsdWUuXHJcbiAgICBpZiAoIXRoaXMuX2V2ZW50Q29sbGVjdGlvbiB8fCAhKGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50Q29sbGVjdGlvbltldmVudF0pKSB7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIGxpc3RlbmVycy5mb3JFYWNoKGZ1bmN0aW9uIChmbiwgaSkge1xyXG4gICAgICBpZiAoZm4gPT09IGxpc3RlbmVyIHx8IGZuLmxpc3RlbmVyID09PSBsaXN0ZW5lcikge1xyXG4gICAgICAgIC8vIFJlbW92ZXMgdGhlIGdpdmVuIGxpc3RlbmVyLlxyXG4gICAgICAgIGxpc3RlbmVycy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFJlbW92ZXMgYW4gZW1wdHkgZXZlbnQgY29sbGVjdGlvbi5cclxuICAgIGlmIChsaXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudENvbGxlY3Rpb25bZXZlbnRdO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICAqIEV4ZWN1dGUgZWFjaCBpdGVtIGluIHRoZSBsaXN0ZW5lciBjb2xsZWN0aW9uIGluIG9yZGVyIHdpdGggdGhlIHNwZWNpZmllZCBkYXRhLlxyXG4gICAqIEBtZW1iZXJvZiEgRW1pdHRlci5wcm90b3R5cGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgeW91IHdhbnQgdG8gZW1pdC5cclxuICAgKiBAcGFyYW0gey4uLk9iamVjdH0gZGF0YSAtIERhdGEgdG8gcGFzcyB0byB0aGUgbGlzdGVuZXJzLlxyXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgRW1pdHRlci5cclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIEVtaXRzIHRoZSBcImZvb1wiIGV2ZW50IHdpdGggJ3BhcmFtMScgYW5kICdwYXJhbTInIGFzIGFyZ3VtZW50cy5cclxuICAgKiBlbWl0dGVyLmVtaXQoJ2ZvbycsICdwYXJhbTEnLCAncGFyYW0yJyk7XHJcbiAgICovXHJcblxyXG4gIEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiBlbWl0KGV2ZW50KSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbiA+IDEgPyBfbGVuIC0gMSA6IDApLCBfa2V5ID0gMTsgX2tleSA8IF9sZW47IF9rZXkrKykge1xyXG4gICAgICBhcmdzW19rZXkgLSAxXSA9IGFyZ3VtZW50c1tfa2V5XTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgbGlzdGVuZXJzID0gdW5kZWZpbmVkO1xyXG5cclxuICAgIC8vIERlZmluZXMgbGlzdGVuZXJzIHZhbHVlLlxyXG4gICAgaWYgKCF0aGlzLl9ldmVudENvbGxlY3Rpb24gfHwgIShsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudENvbGxlY3Rpb25bZXZlbnRdKSkge1xyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICAvLyBDbG9uZSBsaXN0ZW5lcnNcclxuICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5zbGljZSgwKTtcclxuXHJcbiAgICBsaXN0ZW5lcnMuZm9yRWFjaChmdW5jdGlvbiAoZm4pIHtcclxuICAgICAgcmV0dXJuIGZuLmFwcGx5KF90aGlzLCBhcmdzKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIHJldHVybiBFbWl0dGVyO1xyXG59KSgpO1xyXG5cclxuLyoqXHJcbiAqIEV4cG9ydHMgRW1pdHRlclxyXG4gKi9cclxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBFbWl0dGVyO1xyXG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHNbXCJkZWZhdWx0XCJdOyJdfQ==
