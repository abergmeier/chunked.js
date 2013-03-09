"use strict";
(function() {
	/**
	 * @const
	 */
	var STREAM = { 
		/**
		 * @const
		 */
		NONE: {
			/**
			 * @const
			 */
			value:        0,
			/**
			 * @const
			 */
			responseType: "arraybuffer",
			partial_arraybuffer: function( request, callback ) {
			},
			load: function() {
				streamMethod.partial_arraybuffer( req, data_extract );
			},
			run: function( req, url ) {
				req.open( "HEAD", url, true );
				req.onload = function() {
					var length = req.getResponseHeader( "Content-Length" );
					length = Number( length );
					if( length ) {
					}
				};

				req.header("Range", "bytes=0-999"
			}
		},
		/**
		 * @const
		 */
		API: {
			/**
			 * @const
			 */
			value:        1 << 0,
			/**
			 * @const
			 */
			responseType: "stream"
		},
		/**
		 * @const
		 */
		MOZ: {
			/**
			 * @const
			 */
			value:        1 << 1,
			/**
			 * @const
			 */
			responseType: "moz-chunked-arraybuffer",
			partial_arraybuffer: function( request, callback ) {
				callback( request.response );
			},
			load: function() {
			},
			run: function( req, url) {
				req.open( "GET", url, true );
				req.responseType = STREAM.MOZ.responseType;
			}
		}
	};
	
	/**
	 * @const
	 */
	var streamMethod = (
		/**
		 * @param {Array.<Object>}
		 */
		function( canidates ) {
			// Test which streaming method is available
			/**
			 * @const
			 */
			var req = new XMLHttpRequest();
			var canidate;
			for( var i = 0; i < canidates.length; ++i ) {
				canidate = canidates[i];
				try {
					// Try stream API
					req.responseType = canidate.responseType;
					console.log( "GOOD" + canidate );
					return canidate;
				} catch( ex ) {
					console.log( "BAD" + ex );
					// Ignore and go to next
				}
			}
			return STREAM.NONE;
		}
	)( [STREAM.API, STREAM.MOZ] );
	
	if( streamMethod == STREAM.API )
		return;
	
	// Need to install wrappers
	
	//TODO: Perhaps check whether wrapper are complete
	
	/**
	 * @constructor
	 */
	window.StreamError = window.StreamError || function() {
	};
	
	(function() {
		// Create Stream object
		/**
		 * @constructor
		 */
		window.Stream = window.Stream || function( data ) {
			/**
			 * @struct
			 */
			var stream = {
				/**
				 * @type {String}
				 */
				type: null,
				close: function() {
					
				},
				_internal: data
			};
			return stream;
		};
	})();
	
	(function() {
		// Extend XMLHttpRequest
		/**
		 * @const
		 */
		var origRequest = window.XMLHttpRequest;
		/**
		 * @constructor
		 * @extends XMLHttpRequest
		 */
		window.XMLHttpRequest = (function() {
			/**
			 * @type {boolean}
			 */
			var _is_stream = false;
			/**
			 * @const
			 */
			var _send = function( target, receiver, data ) {
				if( data.prototype !== Stream.prototype )
					return target.send( data );
				
				// Is Stream
				return target.send( data._internal );
			};
			/**
			 * Handler to extends XMLHttpRequest according to
			 * Streams API
			 * @struct
			 */
			var proxyHandler = {
				/**
				 * @return {*}
				 */
				get: function( target, name, receiver) {
					if( _is_stream ) {
						if( name === "responseType")
							return STREAM.API.responseType;
			
						if( name === "response" ) {
							if( receiver.error )
								return null;
							else if( readyState === receiver.LOADING ) {
								return new Stream( receiver[name] );
							}
						}
					}
					
					if( name === "send" )
						return function( data ) {
							return _send( target, receiver, data );
						};
					
					return target[name];
				},
				/**
				 * @return {boolean}
				 */
				set: function( target, name, val, receiver) {
					if( name === "responseType" ) {
						if( val === "stream" ) {
							// Add special stream handling
							_is_stream = true;
							val = streamMethod.responseType;
						} else
							_is_stream = false;
					}
					
					return target[name] = val;
				} 
			};
			return new Proxy( origRequest, proxyHandler );
		})();
	})();
	
	/**
	 * @constructor
	 */
	window.StreamReader |= function() {
		/**
		 * @struct
		 */
		var reader = {
			/** 
			 * @param {Stream}
			 * @param {number}
			 */
			readAsBlob: function( stream, maxSize ) {
			},
			/**
			 * @param {Stream}
			 * @param {number=} opt_argument
			 */
			readAsArrayBuffer: function( stream, maxSize ) {
				maxSize = maxSize || stream._internal.byteLength;
				result = stream._internal.slice( 0, maxSize );
			},
			/**
			 * @param {Stream}
			 * @param {String=} opt_argument
			 * @param {number=} opt_argument
			 */
			readAsText: function( stream, encoding, maxSize ) {
			},
			/**
			 * @param {Stream}
			 * @param {number=} opt_argument
			 */
			readAsDataURL: function( Stream, maxSize ) {
			},
			abort: function() {
			},
			/**
			 * @const
			 * @type {number}
			 */
			EMPTY: 0,
			/**
			 * @const
			 * @type {number}
			 */
			LOADING: 1,
			/**
			 * @const
			 * @type {number}
			 */
			DONE: 2,
			/**
			 * readonly attribute
			 * @type {number}
			 */
			readyState: 0,
			/**
			 * readonly attribute
			 * @type {*}
			 */
			result: null,
			/**
			 * readonly attribute
			 * @type {StreamError}
			 */
			error      : null,
			onloadstart: null,
			onprogress : null,
			onload     : null,
			onabort    : null,
			onerror    : null,
			onloadend  : null
		};
		return reader;
	})();
	
})();
