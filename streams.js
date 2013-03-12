"use strict";
(function() {
	/**
	 * @const
	 */
	var global = window;
	/**
	 * @const
	 */
	var config = { is_worker: !(window && window.document)
	};
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
			responseType: "blob",
			partial_arraybuffer: function( request, callback ) {
			},
			/**
			 * Load every chunk separately, so we can provide partial download
			 * data
			 * @const
			 * @param {XMLHttpRequest}
			 * @param {String}
			 * @param
			 * @param {number=} opt_param
			 */
			load_chunked: function( req, url, callbacks, length) {
				var range = { chunk: 1000,
				              start : 0,
				              end   : 1000,
				              length: length
				};
				/**
				 * chain function gets called repeatedly, till all chunks are
				 * read
				 * @const
				 */
				var chain = function() {
					req.open( "GET", url, config.async );
					req.responseType = STREAM.NONE.responseType;
					(function() {
						/**
						 * Special request handler
						 * @const
						 */
						var value = "bytes=" + range.start + "-" + range.end;
						req.setRequestHeader( "Range", value );
					})();
					req.onload = function( event ) {
						if( range.end === range.length ) {
							// Downloaded everything successfully
							callbacks.load( event );
							return;
						}
						
						// Next chunk
						range.start += range.chunk;
						range.end   += range.chunk;
						range.end   = Math.min( range.end, range.length );
						global.setTimeout( chain, 1 );
					};
					req.onerror = function( event ) {
						// Fallback to whole file download
						STREAM.NONE.load_complete( req, url );
					};
				};
				chain();
			},
			/**
			 * Normal file download, as a whole
			 * @const
			 * @param {XMLHttpRequest}
			 * @param {String}
			 * @param
			 */
			load_complete: function( req, config, callbacks ) {
				req.open( "GET", config.url, config.async );
				req.responseType = STREAM.NONE.responseType;
				req.onload = function( event ) {
					callbacks.load();
				};
				req.onerror = function( event ) {
					callbacks.error();
				};
				req.send();
			},
			send: function( req, config, callbacks ) {
				req.open( "HEAD", config.url, config.async );
				req.responseType = "";
				req.onload = function( event ) {
					var length = req.getResponseHeader( "Content-Length" );
					length = Number( length );
					if( length == 0 )
						STREAM.NONE.load_complete( req, config, callbacks );
					else
						STREAM.NONE.load_chunked( req, config, callbacks, length );
				};
				req.onerror = function( event ) {
					// TODO: Only fall back to load, when error
					// is recoverable!
					STREAM.NONE.load_complete( req, config );
				};
				req.send();
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
			responseType: "stream",
			send: undefined
		},
		/**
		 * Config data for redirecting to Mozilla specific variant
		 * @const
		 * @struct
		 */
		MOZ: {
			/**
			 * @const
			 */
			value:        1 << 1,
			/**
			 * @const
			 */
			chunked_maps: { "text"       : "moz-chunked-text",
			                "arraybuffer": "moz-chunked-arraybuffer",
			                "blob"       : "moz-chunked-blob",
				
			},
			responseType: "moz-chunked-arraybuffer",
			send: function( req, config, callbacks ) {
				req.open( config.method, config.url, config.async );
				if( config.method === "text") {
					"moz-chunked-text"
				}
				
			}
		}
	};
	
	/**
	 * Best available method/config to be used for emulating streaming.
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
	
	// No native support, so start emulating
	/**
	 * @const
	 * @param {String}
	 * @param {ProgressEventInit=} opt_param
	 */
	var fireEvent = function( object, eventName, progressInit ) {
		/**
		 * @const
		 */
		var event = new ProgressEvent( eventName, progressInit);
		/**
		 * @const
		 */
		var callback = object[ "on" + eventName ];
		if( !callback )
			return;
		
		callback( event );
	};
	
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
			var internal = { 
				position: 0,
				/**
				 * @type {number}
				 */
				readyState: this.EMPTY,
				arrayBuffer: null,
				get left() {
					return internal.arrayBuffer.length - internal.position;
				},
				type: null
			};
			Object.defineProperties(
				this,
				{
					type: { get: function() { return internal.type; } }
				}
			);
			this.close = function() {
				
			};
			this._readAsDataView = function( maxSize ) {
				var dataView;
				if( maxSize === undefined )
					dataView = new DataView( internal.arrayBuffer, position );
				else
					dataView = new DataView( internal.arrayBuffer, position, maxSize );
				internal.position += dataView.byteLength;
				if( !internal.left )
					internal.readyState = this.DONE;
				return dataView;
			};
			/**
			 * Use this only when you REALLY need an array buffer. Makes a copy!
			 */
			this._readAsArrayBuffer = function( maxSize ) {
				var arrayBuffer;
				if( maxSize === undefined || internal._left === maxSize )
					arrayBuffer = internal.arrayBuffer;
				else
					arrayBuffer = internal.arrayBuffer.slice( internal.position, maxSize );
				internal.position += arrayBuffer.byteLength;
				if( !internal._left )
					internal.readyState = this.DONE;
				return arrayBuffer;
			};
		};
	})();
	
	(function() {
		/**
		 * Extend XMLHttpRequest
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
				 * @const
				 */
				var base = new origRequest();
				/**
				 * @const
				 */
				var internal = {
					/**
					 * @type {boolean}
					 */
					is_stream: false,
					
					method: null,
					async: true,
					user: null,
					password: null,
					/**
					 * @const
					 * @param {String}
					 * @param {String}
					 * @param {boolean=} opt_param
					 * @param {String=} opt_param
					 * @param {String=} opt_param
					 */
					open: function( method, url, async, user, password ) {
						if( async === undefined )
							async = true;
						
						internal.method   = method;
						internal.async    = async;
						internal.user     = user;
						internal.password = password;
					},
					/**
					 * @const
					 */
					send: function( data ) {
						var config = { method  : internal.method,
						               asyc    : internal.async,
						               user    : internal.user,
						               password: internal.password
						};
						streamMethod.send( this, config );
					},
					getResponseType: function() {
						if( internal.is_stream )
							return STREAM.API.responseType;
						return base.responseType;
					},
					setResponseType: function( val ) {
						if( val === "stream" ) {
							// Add special stream handling
							internal.is_stream = true;
							val = streamMethod.responseType;
						} else
							internal.is_stream = false;
						base.responseType = val;
					},
					getResponse: function() {
						if( internal.is_stream ) {
							if( base.error )
								return null;
							else if( base.readyState === this.LOADING ) {
								return new Stream( base.response );
							}
						}
						return base.response;
					}
				};

				/**
				 * @const
				 */
				var fix = function( funcName ) {
					return base[funcName].bind( base );
				};
				Object.defineProperties(
					this,
					{
						"responseType"         : { get  : internal.getResponseType,
						                           set  : internal.setResponseType                 },
						"response"             : { get  : internal.getResponse                     },
						"readyState"           : { get  : function() { return base.readyState  ; } },
						"open"                 : { value: fix("open"                             ) },
						"setRequestHeader"     : { value: fix("setRequestHeader"                 ) },
						"upload"               : { get  : function() { return base.upload      ; } },
						"send"                 : { value: fix("send"                             ) },
						"abort"                : { value: fix("abort"                            ) },
						"status"               : { get  : function() { return base.status      ; } },
						"statusText"           : { get  : function() { return base.statusText  ; } },
						"getResponseHeader"    : { value: fix("getResponseHeader"                ) },
						"getAllResponseHeaders": { value: fix("getAllResponseHeaders"            ) },
						"overrideMimeType"     : { value: fix("overrideMimeType"                 ) },
						"responseText"         : { get  : function() { return base.responseText; } },
						"responseXML"          : { get  : function() { return base.responseXML ; } },
						"addEventListener"     : { value: fix("addEventListener"                 ) }
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
	 * Implements StreamReader interface
	 * @constructor
	 */
	window.StreamReader = window.StreamReader || (function() {
		var constructor = function() {
			var internal = {
				/**
				 * @type {*}
				 */
				result: null,
				/**
				 * @type {StreamError}
				 */
				error: null,
				/**
				 * @type {boolean}
				 */
				is_closed: false,
				readyState: this.EMPTY
			};
			
			/** 
			 * @param {Stream}
			 * @param {number=} opt_param
			 */
			this.readAsBlob = function( stream, maxSize ) {
				if( maxSize !=== undefined && maxSize < 1 )
					throw new InvalidArgumentException();
				if( this.readyState === this.LOADING )
					throw NOT_ALLOWED_ERR();
				internal.readyState = this.LOADING;
				fireEvent( this, "loadstart" );
				var callback = function( dataView ) {
					internal.readyState = this.DONE;
					internal.result = new Blob( dataView );
					fireEvent( this, "load"    );
					fireEvent( this, "loadend" );
				};
				
				stream._readAsDataView( { load: function() {
				                          },
				                          progress: function() {
				                        	  
				                          },
				                          error: function() {
				                          }
				                        },
				                        maxSize );
				}
			};
			/**
			 * @param {Stream}
			 * @param {number=} opt_argument
			 */
			this.readAsArrayBuffer = function( stream, maxSize ) {
				if( this.readyState == this.LOADING )
					throw new InvalidStateError();
				if( internal.is_closed )
					throw new InvalidStateError();
				
				internal.result = stream._readAsArrayBuffer( maxSize );
				internal.readyState = this.LOADING;
				fireEvent( this, "loadstart" );
				var process = function() {
					this.readyState = this.DONE;
				};
				global.setTimeout( process, 0 );
			};
			/**
			 * @param {Stream}
			 * @param {String=} opt_argument
			 * @param {number=} opt_argument
			 */
			this.readAsText = function( stream, encoding, maxSize ) {
				throw new NotImplementedException();
			};
			/**
			 * @param {Stream}
			 * @param {number=} opt_argument
			 */
			this.readAsDataURL = function( Stream, maxSize ) {
				throw new NotImplementedException();
			};
			/**
			 * See http://dev.w3.org/2006/webapi/FileAPI/#readAsArrayBuffer
			 */
			this.abort = function() {
				if( this.readyState == this.EMPTY || this.readyState == this.DONE ) {
					internal.result = null;
					return;
				}
				
				if( this.readyState == this.LOADING ) {
					internal.readyState = this.DONE;
					internal.result = null;
				}
				fireEvent( this, "abort"   );
				fireEvent( this, "loadend" );
			};
			this.onloadstart = null;
			this.onprogress  = null;
			this.onload      = null;
			this.onabort     = null;
			this.onerror     = null;
			this.onloadend   = null;
		
			// Add properties
			Object.defineProperties(
				this,
				{
					"readyState": { get: function() {
					                     	return internal.readyState;
					                } },
					"result"    : { get: function() {
					                     	return internal.result;
					                } },
					"error"     : { get: function() {
					                     	return internal.error;
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
	
	// Setup sync
	window.StreamReaderSync = window.StreamReaderSync || (function() {
		var constructor = {
			/**
			 * @param {Stream}
			 * @param {number=} opt_param
			 * @returns {Blob}
			 */
			readAsBlob: function( stream, maxSize ) {
				return new Blob( stream._readAsDataView(maxSize) );
			},
			/**
			 * @param {Stream}
			 * @param {number=} opt_param
			 * @returns {ArrayBuffer}
			 */
			readAsArrayBuffer: function( stream, maxSize ) {
				if( maxSize === undefined )
					return stream._readAsArrayBuffer();
				else if( maxSize < 1 )
					throw new InvalidArgumentException();
				else
					return stream._readAsArrayBuffer( maxSize );
			},
			/**
			 * @param {Stream}
			 * @param {String=} opt_param
			 * @param {number=} opt_param
			 * @returns {String}
			 */
			readAsText: function( stream, encoding, maxSize ) {
				
			},
			/**
			 * @param {Stream}
			 * @param {number=} opt_param
			 */
			readAsDataURL: function( stream, maxSize ) {
				
			}
		};
		return constructor;
	})();

})();
