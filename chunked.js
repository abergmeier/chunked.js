(function() {
	"use strict";
	/**
	 * @const
	 */
	var config = { is_worker: !(window && window.document)
	};
	
	/**
	 * @const
	 */
	var global = config.is_worker ? self : window;
	
	var CHUNKED_RESPONSE_TYPES = { text       : "chunked-text"       ,
	                               arraybuffer: "chunked-arraybuffer",
	                               blob       : "chunked-blob"         };
	/**
	 * @const
	 */
	var VARIANTS = { 
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
					req.responseType = VARIANTS.NONE.responseType;
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
						VARIANTS.NONE.load_complete( req, url );
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
				req.responseType = VARIANTS.NONE.responseType;
				req.onload = function( event ) {
					callbacks.load();
				};
				req.onerror = function( event ) {
					callbacks.error();
				};
				req.send();
			},
			IGNORED_METHODS: [ "CONNECT", "HEAD" ],
			handles: function( config ) {
				return !( config.method in VARIANTS.NONE.IGNORED_METHODS );
			},
			send: function( req, config, callbacks ) {
				if( config.method )
				req.open( "HEAD", config.url, config.async );
				req.responseType = "";
				req.onload = function( event ) {
					var length = req.getResponseHeader( "Content-Length" );
					length = Number( length );
					if( length == 0 )
						VARIANTS.NONE.load_complete( req, config, callbacks );
					else
						VARIANTS.NONE.load_chunked( req, config, callbacks, length );
				};
				req.onerror = function( event ) {
					// TODO: Only fall back to load, when error
					// is recoverable!
					VARIANTS.NONE.load_complete( req, config, callbacks );
				};
				req.send();
			}
		},
		/**
		 * @const
		 */
		STREAM_API: {
			/**
			 * @const
			 */
			value:        1 << 0,
			/**
			 * @const
			 */
			RESPONSE_TYPE: "stream",
			/**
			 * @param
			 */
			handles: function( config ) {
				return false;
			},
			FLAGS: { TEXT       : 1 << 1,
			         ARRAYBUFFER: 1 << 2,
			         BLOB       : 1 << 3
			},
			FLAG_MAPPINGS: { "chunked-text"       : VARIANTS.STREAM_API.FLAGS.TEXT       ,
			                 "chunked-arraybuffer": VARIANTS.STREAM_API.FLAGS.ARRAYBUFFER,
			                 "chunked-blob"       : VARIANTS.STREAM_API.FLAGS.BLOB
			},
			/**
			 * @const
			 * @param {number}
			 * @param
			 * @param {XMLHttpRequest}
			 */
			extract_response: function( flags, reader, req ) {
				var response;
				if( flags | VARIANTS.STREAM_API.FLAGS.TEXT )
					response = reader.readAsBlob( req.response );
				else if( flags | VARIANTS.STREAM_API.FLAGS.ARRAYBUFFER )
					response = reader.readAsArrayBuffer( req.response );
				else if( flags | VARIANTS.STREAM_API.FLAGS.TEXT)
					response = reader.readAsText( req.response );
				else
					console.log("Unhandled flags" + flags);
				return response;
			},
			send: function( req, config, callbacks ) {
				/**
				 * @const
				 */
				var reader = new StreamReaderSync();
				req.open( config.method,
				          config.url   ,
				          config.async   );
				req.responseType = VARIANTS.STREAM_API.RESPONSE_TYPE;
				var flags = VARIANTS.STREAM_API.FLAG_MAPPINGS[ config.responseType ];
				req.onloadstart = function( event ) {
					callbacks.loadstart( event,
					                     VARIANTS.STREAM_API.extract_response( flags ,
					                                                           reader,
					                                                           req     ) );
				};
				req.onloadend = function( event ) {
					callbacks.loadend( event,
					                   VARIANTS.STREAM_API.extract_response( flags ,
					                                                         reader,
					                                                         req     ) );
				};
				req.onload = function( event ) {
					callbacks.load( event,
					                VARIANTS.STREAM_API.extract_response( flags,
					                                                      reader,
					                                                      req     ) );
				};
				req.onerror = callbacks.error;
				req.onabort = callbacks.abort;
				req.send();
			}
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
			 * @struct
			 */
			CHUNKED_MAPPINGS: { "chunked-text"       : "moz-chunked-text",
			                    "chunked-arraybuffer": "moz-chunked-arraybuffer",
			                    "chunked-blob"       : "moz-chunked-blob"
			},
			/**
			 * @const
			 * @param {String}
			 * @returns {boolean}
			 */
			handles: function( config ) {
				return config.responseType in VARIANTS.MOZ.CHUNKED_MAPPINGS;
			},
			responseType: VARIANTS.MOZ.CHUNKED_MAPPINGS[ "chunked-arraybuffer" ],
			send: function( req, config, callbacks ) {
				req.open( config.method,
				          config.url,
				          config.async );
				req.responseType = VARIANTS.MOZ.CHUNKED_MAPPINGS[ config.responseType ];
				req.onloadstart = callbacks.loadstart;
				req.onloadend   = callbacks.loadend;
				req.onload      = callbacks.load;
				req.onerror     = callbacks.error;
				req.onabort     = callbacks.abort;
				req.send( config.data );
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
			return VARIANTS.NONE;
		}
	)( [VARIANTS.STREAM_API, VARIANTS.MOZ] );
	
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
	
	(function() {
		/**
		 * Extend XMLHttpRequest
		 * @constructor
		 * @extends XMLHttpRequest
		 */
		window["XMLHttpRequest"] = (function( origRequest ) {
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
					is_chunked: false,
					
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
					CHUNKED_RESPONSE_TYPES: [ "chunked-text"       ,
					                          "chunked-arraybuffer",
					                          "chunked-blob"
					],
					/**
					 * @const
					 */
					send: function( data ) {
						/**
						 * @const
						 * @struct
						 */
						var config = { method      : internal.method      ,
						               asyc        : internal.async       ,
						               user        : internal.user        ,
						               password    : internal.password    ,
						               responseType: internal.responseType,
						               data        : data
						};
						if( config.responseType in CHUNKED_RESPONSE_TYPES
						 || streamMethod.handles( config ) ) {

							streamMethod.send( this, config, callbacks );
						} else {
							base.send( data );
						}
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
						"responseType"         : { value: fix("responseType"                     ) },
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
			return wrapper;
		})( window.XMLHttpRequest );
	})();

})();
