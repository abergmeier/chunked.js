"use strict";
(function() {
	/**
	 * @const
	 */
	var global = window;
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

				//req.header("Range", "bytes=0-999"
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
					// We have to check value, since the former line
					// doesn't have to throw an exception according
					// to spec.
					if( req.responseType !== canidate.responseType )
						continue;
					return canidate;
				} catch( ex ) {
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
		 * @constructor
		 * @extends XMLHttpRequest
		 */
		window.XMLHttpRequest = (function( origRequest ) {
			
			/**
			 * @const
			 * @type {XMLHttpRequest}
			 */
			var wrapper = function() {
				/**
				 * @type {boolean}
				 */
				var _is_stream = false;
				/**
				 * @const
				 */
				var _internal = new origRequest();
				/**
				 * @const
				 * @param {String}
				 * @param {String}
				 * @param {boolean=} opt_param
				 * @param {String=} opt_param
				 * @param {String=} opt_param
				 */
				var _open = function( method, url, async, user, password ) {
					if( async === undefined )
						async = true;
					
					return _internal.open( method, url, async, user, password );
				};
				/**
				 * @const
				 */
				var _send = function( data ) {
					if( data.isPrototypeOf( global.Stream ) ) {
						// Is Stream
						return _internal.send( data._internal );
					}
					
					return _internal.send( data );
				};
				/**
				 * @const
				 */
				var fix = function( func ) {
					return func.bind( _internal );
				};
				Object.defineProperties(
					this,
					{
						"responseType": { get: function() {
						                       	if( _is_stream )
						                       		return STREAM.API.responseType;
						                       	return _internal.responseType;
						                  },
						                  set: function( val ) {
						                       	if( val === "stream" ) {
						                       		// Add special stream handling
						                       		_is_stream = true;
						                       		val = streamMethod.responseType;
						                       	} else
						                       		_is_stream = false;
						                       _internal.responseType = val;
						                  } },
						"response"    : { get: function() {
						                       	if( _is_stream ) {
						                       		if( _internal.error )
						                       			return null;
						                       		else if( _internal.readyState === this.LOADING ) {
						                       			return new Stream( _internal.response );
						                       		}
						                       	}
						                       	return _internal.response;
						                  } },
						"readyState"           : { get: function() { return _internal.readyState;   } },
						"open"                 : { value: _internal.open.bind(_internal             ) },
						"setRequestHeader"     : { value: _internal.open.bind(_internal             ) },
						"upload"               : { get: function() { return _internal.upload;       } },
						"send"                 : { value: _internal.send.bind(_internal             ) },
						"abort"                : { value: _internal.abort.bind(_internal            ) },
						"status"               : { get: function() { return _internal.status;       } },
						"statusText"           : { get: function() { return _internal.statusText;   } },
						"getResponseHeader"    : { value: fix(_internal.getResponseHeader           ) },
						"getAllResponseHeaders": { value: fix(_internal.getAllResponseHeaders       ) },
						"overrideMimeType"     : { value: fix(_internal.overrideMimeType            ) },
						"responseText"         : { get: function() { return _internal.responseText; } },
						"responseXML"          : { get: function() { return _internal.responseXML;  } },
						"addEventListener"     : { value: fix(_internal.addEventListener            ) }
					}
				);
				
			}
			
			wrapper.prototype = new origRequest();
/*			
			Object.defineProperty( proxy,
			                       "LOADING",
			                       { value: origRequest.LOADING,
			                         writeable: false }
			);
*/
			return wrapper;
		})( window.XMLHttpRequest );
	})();
	
	/**
	 * @constructor
	 */
	window.StreamReader = window.StreamReader || (function() {
		var constructor = function() {
			/**
			 * @type {number}
			 */
			var _readyState = constructor.EMPTY;
			/**
			 * @type {*}
			 */
			var _result     = null;
			/**
			 * @type {StreamError}
			 */
			var _error      = null;
			return Object.create(
				{
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
					onloadstart: null,
					onprogress : null,
					onload     : null,
					onabort    : null,
					onerror    : null,
					onloadend  : null
				},
				// Add properties
				{
					"readyState": { get: function() {
					                     	return _readyState;
					                } },
					"result"    : { get: function() {
					                     	return _result;
					                } },
					"error"     : { get: function() {
					                     	return _error;
					                } }
				}
			);
		};
		
		Object.defineProperties( constructor,
		                         { "EMPTY"  : { value: 0, writeable: false },
		                           "LOADING": { value: 1, writeable: false },
		                           "DONE"   : { value: 2, writeable: false }
		                         }
		);
		return constructor;
	})();

})();
