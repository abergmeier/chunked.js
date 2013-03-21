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
	
	var CHUNKED_RESPONSE_TYPES = { TEXT       : "chunked-text"       ,
	                               ARRAYBUFFER: "chunked-arraybuffer",
	                               BLOB       : "chunked-blob"         };
	var mozArrayBuffer = "moz-chunked-arraybuffer";
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
			RESPONSE_TYPE_MAP: { "chunked-text"       : "text"       ,
			                     "chunked-arraybuffer": "arraybuffer",
			                     "chunked-blob"       : "blob"         },
			/**
			 * Load every chunk separately, so we can provide partial download
			 * data
			 * @const
			 * @param {XMLHttpRequest}
			 * @param {String}
			 * @param
			 * @param {number=} opt_param
			 */
			load_chunked: function( req, callbacks, length) {
				var range = (function( length ) {
					var chunk = Math.min( length / 100 , 1024 * 1024 );
					return { chunk : chunk,
					         start : 0,
					         end   : chunk,
					         length: length
					};
				})( length );
				/**
				 * chain function gets called repeatedly, till all chunks are
				 * read
				 * @const
				 */
				var chain = function() {
					req.open( "GET", this.internal.url, this.internal.async, this.internal.user, this.internal.password );
					req.responseType = VARIANTS.NONE.RESPONSE_TYPE_MAP[ this.internal.responseType ];
					(function() {
						/**
						 * Special request handler
						 * @const
						 */
						var value = "bytes=" + range.start + "-" + range.end;
						req.setRequestHeader( "Range", value );
					}).call( this );
					req.onload = function( event ) {
						(function() {
							var progressEvent = Object.create( event, {
								"lengthComputable": { value: true         },
								"loaded"          : { value: range.end    },
								"total"           : { value: range.length }
							} );
							this.internal.response = req.response;
							callbacks.progress.call( this, progressEvent );
						}).call( this );
						
						if( range.end === range.length ) {
							// Downloaded everything successfully
							callbacks.load.call( this, event );
							return;
						}
						
						// Next chunk
						range.start += range.chunk;
						range.end   += range.chunk;
						range.end   = Math.min( range.end, range.length );
						global.setTimeout( chain, 1 );
					}.bind( this );
					req.onerror = function( event ) {
						this.internal.response = null;
						// Fall back to whole file download
						VARIANTS.NONE.load_complete.call( this, req, url );
					}.bind( this );
					req.send();
				}.bind( this );
				chain();
			},
			/**
			 * Normal file download, as a whole
			 * @const
			 * @param {XMLHttpRequest}
			 * @param {String}
			 * @param
			 */
			load_complete: function( req, callbacks ) {
				req.open( "GET", this.internal.url, this.internal.async, this.internal.user, this.internal.password );
				req.responseType = VARIANTS.NONE.responseType;
				req.onload = function( event ) {
					callbacks.load.call( this );
				}.bind( this );
				req.onerror = function( event ) {
					callbacks.error.call( this )();
				}.bind( this );
				req.send();
			},
			IGNORED_METHODS: [ "CONNECT", "HEAD" ],
			handles: function( config ) {
				return !( config.method in VARIANTS.NONE.IGNORED_METHODS );
			},
			send: function( req, callbacks ) {
				req.open( "HEAD", this.internal.url, this.internal.async, this.internal.user, this.internal.password );
				req.responseType = "text";
				req.onload = function( event ) {
					var length = req.getResponseHeader( "Content-Length" );
					length = Number( length );
					if( length === 0 )
						VARIANTS.NONE.load_complete.call( this, req, callbacks );
					else
						VARIANTS.NONE.load_chunked.call( this, req, callbacks, length );
				}.bind( this );
				req.onerror = function( event ) {
					// TODO: Only fall back to load, when error
					// is recoverable!
					VARIANTS.NONE.load_complete.call( this, req, config, callbacks );
				}.bind( this );
				req.send();
			},
			/**
			 * @param {String}
			 * @param
			 * @param {boolean=} opt_param
			 */
			"addEventListener": function( type, listener, useCapture ) {
				if( !(type in VARIANTS.NONE.LISTENERS) )
					throw new RangeError("'" + type + " not handled.");
				
				// Handle progress
				//TODO: Handle useCapture
				this.listeners = this.listeners || Object.create( VARIANTS.NONE.LISTENERS );
				
				var registry = this.listeners[type];
				registry.push( listener );
			},
			"removeEventListener": function( type, listener, useCapture ) {
				if( !(type in VARIANTS.NONE.LISTENERS) )
					throw new RangeError("'" + type + " not handled.");
				
				this.listeners = this.listeners || Object.create( VARIANTS.NONE.LISTENERS );
				
				var registry = this.listeners[type];
				for( var i = registry.length - 1; i >= 0; --i ) {
					if( registry[i] === listener ) {
						registry.splice( i, 1 );
						break;
					}
				}
			},
			/**
			 * @const
			 */
			LISTENERS: { "loadstart": [],
			             "progress" : [],
			             "abort"    : [],
			             "error"    : [],
			             "load"     : [],
			             "timeout"  : [],
			             "loadend"  : [] 
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
			/**
			 * @dict
			 */
			FLAGS: { "chunked-text"       : 1 << 1,
			         "chunked-arraybuffer": 1 << 2,
			         "chunked-blob"       : 1 << 3
			},
			/**
			 * @const
			 * @param {number}
			 * @param
			 * @param {XMLHttpRequest}
			 */
			extract_response: function( flags, reader, req ) {
				var response;
				if( flags | VARIANTS.STREAM_API.FLAGS[CHUNKED_RESPONSE_TYPES.TEXT] )
					response = reader.readAsBlob( req.response );
				else if( flags | VARIANTS.STREAM_API.FLAGS[CHUNKED_RESPONSE_TYPES.ARRAYBUFFER] )
					response = reader.readAsArrayBuffer( req.response );
				else if( flags | VARIANTS.STREAM_API.FLAGS[CHUNKED_RESPONSE_TYPES.BLOB] )
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
			                    "chunked-arraybuffer": mozArrayBuffer,
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
			/**
			 * @const
			 */
			RESPONSE_TYPE: mozArrayBuffer,
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
					req.responseType = canidate.RESPONSE_TYPE;
					// We have to check value, since the former line
					// doesn't have to throw an exception according
					// to spec.
					if( req.responseType !== canidate.RESPONSE_TYPE )
						continue;
					return canidate;
				} catch( ex ) {
					// Ignore and go to next
				}
			}
			return VARIANTS.NONE;
		}
	)( [VARIANTS.STREAM_API/*, VARIANTS.MOZ*/] );
	
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
				var instance = this;
				/**
				 * @const
				 */
				var internal = {
					/**
					 * @type {boolean}
					 */
					is_chunked: false,
					responseType: "",
					method: null,
					url: null,
					async: true,
					user: null,
					password: null,
					data:     undefined,
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
						internal.url      = url;
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
						internal.responseType = this.responseType;
						internal.data = data;
						internal.is_chunked = internal.responseType in CHUNKED_RESPONSE_TYPES
						                   || streamMethod.handles( internal );

						if( internal.is_chunked ) {
							var callbacks = {
								load: function( event ) {
									
								},
								progress: function( event ) {
									if( !internal.listeners )
										return;
									for( var i = 0; i != internal.listeners.length; ++i ) {
										internal.listeners[i].progress( event );
									}
								}
							};
							streamMethod.send.bind( instance )( base, callbacks );
						} else {
							base.responseType = responseType;
							base.open( internal.method, internal.url,
							           internal.async, internal.user,
							           internal.password );
							base.send( data );
						}
						internal.data = undefined;
					},
					getResponse: function() {
						if( internal.is_chunked )
							return internal.response;
						else
							return base.response;
					}
				};

				/**
				 * @const
				 */
				var fix = function( funcName ) {
					return base[funcName].bind( base );
				};
				/**
				 * @const
				 */
				var overwrite = function( funcName ) {
					var method = streamMethod[funcName];
					if( method )
						return method.bind( instance );
					
					return fix( funcName );
				};
				Object.defineProperties(
					this,
					{ "internal"             : { get  : function() { return internal;          } },
					  "responseType"         : { value: internal.responseType,
					                             enumerable: true,
					                             writable:   true                                },
					  "response"             : { get  : internal.getResponse                     },
					  "readyState"           : { get  : function() { return base.readyState  ; } },
					  "open"                 : { value: internal.open                            },
					  "setRequestHeader"     : { value: fix("setRequestHeader"                 ) },
					  "upload"               : { get  : function() { return base.upload      ; } },
					  "send"                 : { value: internal.send                            },
					  "abort"                : { value: fix("abort"                            ) },
					  "status"               : { get  : function() { return base.status      ; } },
					  "statusText"           : { get  : function() { return base.statusText  ; } },
					  "getResponseHeader"    : { value: fix("getResponseHeader"                ) },
					  "getAllResponseHeaders": { value: fix("getAllResponseHeaders"            ) },
					  "overrideMimeType"     : { value: fix("overrideMimeType"                 ) },
					  "responseText"         : { get  : function() { return base.responseText; } },
					  "responseXML"          : { get  : function() { return base.responseXML ; } },
					  "addEventListener"     : { value: overwrite("addEventListener"           ) },
					  "removeEventListener"  : { value: overwrite("removeEventListener"        ) }  }
				);
			};
			
			wrapper.prototype = new origRequest();
			return wrapper;
		})( window.XMLHttpRequest );
	})();

})();
