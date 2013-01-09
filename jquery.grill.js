;(function(window, undefined) {
    /* Debounce and throttle functions taken from underscore.js */
    window.debounce = function(func, wait, immediate) {
        var timeout;
        return function() {
          var context = this, args = arguments;
          var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
          };
          if (immediate && !timeout) func.apply(context, args);
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
        };
    };


    window.throttle = function(func, wait) {
        var context, args, timeout, throttling, more, result;
        var whenDone = debounce(
            function(){ more = throttling = false; }, wait);
        return function() {
          context = this; args = arguments;
          var later = function() {
            timeout = null;
            if (more) func.apply(context, args);
            whenDone();
          };
          if (!timeout) timeout = setTimeout(later, wait);
          if (throttling) {
            more = true;
          } else {
            result = func.apply(context, args);
          }
          whenDone();
          throttling = true;
          return result;
        };
    };

})(window);


/*
 * Grill
 */
;(function($, window, document, undefined) {

    var defaults = {
        widgetSelector: '.dtm-panel-widget',
        draggable: {
          items: '.dtm-panel',
          handle: '.dtm-panel-header, .dtm-panel-header h4'
        }
    };

    function Grill(el, options) {
      this.options = $.extend(true, defaults, options);
      this.$el = $(el);
      this.$wrapper = this.$el.parent();
      this.$widgets = this.$el.children(this.options.widgetSelector);
      this.widgets = [];
      this.gridSetup = [];
      this.wrapperWidth = this.$wrapper.width();
      this.containerWidth = this.$el.width();
      this.widgetHeight = 302;
      this.rowMargin = 20;
      this.init();
    }

    var fn = Grill.prototype;

    fn.init = function() {
      this.getGridSetup();
      this.draggable();
    };

    fn.getGridSetup = function() {
      var i = 0;
      for (i; i < this.$widgets.length; i++) {
        this.gridSetup.push(parseInt(this.$widgets[0].className.match(/grid(\d+)/i)[1]));
      }
    }


    /**
    * Make widgets draggable.
    *
    * @uses Draggable
    * @method draggable
    * @return {Class} Returns the instance of the Gridster Class.
    */
    fn.draggable = function() {
        var self = this;
        var draggable_options = $.extend(true, {}, this.options.draggable, {
            start: function(event, ui) {
                self.$player = $(this);
                self.$helper = self.options.draggable.helper === 'clone' ? $(ui.helper) : self.$player;
                self.helper = !self.$helper.is(self.$player);
                self.on_start_drag.call(self, event, ui);
                self.$el.trigger('grill:dragstart');
            },
            stop: function(event, ui) {
                self.on_stop_drag.call(self, event, ui);
                self.$el.trigger('grill:dragstop');
            },
            drag: throttle(function(event, ui) {
                self.on_drag.call(self, event, ui);
                self.$el.trigger('grill:drag');
            }, 60)
          });

        this.drag_api = this.$el.drag(draggable_options).data('drag');
        return this;
    };


    /**
    * This function is executed when the player begins to be dragged.
    *
    * @method on_start_drag
    * @param {Event} The original browser event
    * @param {Object} A prepared ui object.
    */
    fn.on_start_drag = function(event, ui) {

      var gridClass = this.getGridClass(ui);

      this.$player.addClass('dtm-panel-inmotion');

      this.$previewHolder = $('<div />', {'class': 'dtm-panel-placeholder ' + gridClass});
      this.$player.before(this.$previewHolder);

      this.$player.coordinates = this.$previewHolder.position();
      this.$previewHolder.previousPosition = this.getQuadrantPosition(this.$player.coordinates);
      this.$previewHolder.startPosition = this.$previewHolder.previousPosition;

      log('Begin at:' + this.indexForPosition(this.$previewHolder.previousPosition))
      // initial absolute position for dragged object
      // otherwise it will jump to 0,0
      this.$player.css({
        top: this.$player.coordinates.top,
        left: this.$player.coordinates.left
      });

      if (this.options.draggable.start) {
        this.options.draggable.start.call(this, event, ui);
      }
    };


    /**
    * This function is executed when the player is being dragged.
    *
    * @method on_drag
    * @param {Event} The original browser event
    * @param {Object} A prepared ui object.
    */
    fn.on_drag = function(event, ui) {

      //break if dragstop has been fired
      if (this.$player === null) {
        return false;
      }

      var previousPos = this.$previewHolder.previousPosition,
          currentPos = this.getQuadrantPosition(ui.position);

      if (previousPos.row != currentPos.row || previousPos.col != currentPos.col) {
        this.relocatePlaceholderToPosition(currentPos);
      }

      if (this.options.draggable.drag) {
        this.options.draggable.drag.call(this, event, ui);
      }
    };


    /**
    * This function is executed when the player stops being dragged.
    *
    * @method on_stop_drag
    * @param {Event} The original browser event
    * @param {Object} A prepared ui object.
    */
    fn.on_stop_drag = function(event, ui) {
      // TODO: fix this up a bit more
      // there is probably still big in here
      var previous = this.indexForPosition(this.$previewHolder.startPosition),
      current = this.indexForPosition(this.$previewHolder.previousPosition),
      temp = null;

      //log('previous:' + previous + ' now:' + current);
      // remove from previous location
      temp = this.$widgets.splice(previous, 1)[0];
      this.$widgets.splice(current, 0, temp);

      this.$player.removeClass('dtm-panel-inmotion').removeAttr('style');
      this.$previewHolder.replaceWith(this.$player);

      //log(this.$widgets)
      if (this.options.draggable.stop) {
        this.options.draggable.stop.call(this, event, ui);
      }

      this.$player = null;
      this.$helper = null;
    };


    /**
    * Get the quadrant where we are dragging
    *
    * @method getQuadrantPosition
    * @param {Object} The absolute position with top/left
    * @return {Object} Returns object with row col values
    */
    fn.getQuadrantPosition = function(currentPosition) {
      var leftSize = Math.abs(currentPosition.left) + this.$player.width() / 2,
          col = (leftSize >= (this.containerWidth - 20) * .5) ? 1 : 0,
          row = parseInt(Math.abs(currentPosition.top) / (this.widgetHeight + this.rowMargin));
      return {row: row, col: col};
    };


    /**
    * Get current player index
    *
    * @method getPlayerIndex
    * @return {int} Returns the index integer value
    */
    fn.getPlayerIndex = function() {
      return this.$widgets.index(this.$player);
    };


    /**
    * Place the preview holder into specified position
    *
    * @method relocatePlaceholderToPosition
    * @param {Object} The position to place the preview holder
    */
    fn.relocatePlaceholderToPosition = function(position) {
      var newIndex = this.indexForPosition(position);
      if (newIndex == 0) {
        this.$el.prepend(this.$previewHolder);
      }
      else {
        if (this.isLastPlayer()) {
          $(this.$widgets[newIndex]).before(this.$previewHolder);
        }
        else {
          $(this.$widgets[newIndex]).after(this.$previewHolder);
        }
      }
      this.$previewHolder.previousPosition = position;
    };


    fn.isLastPlayer = function() {
      return (this.getPlayerIndex() == this.$widgets.length - 1) ? true : false;
    }

    /**
    * Get widget index for row/col position
    *
    * @method indexForPosition
    * @param {Object} The object holding row and col values 
    * @return {int} Returns integer index value
    */
    fn.indexForPosition = function(position) {
      var i = 0, occupiedBy = null, fancyIndex = position.row * 2 + position.col;

      if (fancyIndex < this.gridSetup.length) {
        occupiedBy = this.gridSetup[fancyIndex];
         return (occupiedBy === 6) ? fancyIndex : fancyIndex - 1;
      }
      else {
        // probably last element
        return this.gridSetup.length - 1;
      }
    };


    /**
    * Get grid class from dragged element
    *
    * @method getGridClass
    * @param {Object} The dragged ui element
    * @return {String} Returns either empty string or grid class name
    */
    fn.getGridClass = function(el) {
      var className = '';
      if (el.helper) {
        className = el.helper.attr('class').match(/grid\d+/i)[0];
      }
      return className;
    };


    //jQuery adapter
    $.fn.grill = function(options) {
     return this.each(function() {
       if (!$(this).data('grill')) {
         $(this).data('grill', new Grill( this, options ));
       }
     });
    };

    $.Grill = fn;

}(jQuery, window, document));

