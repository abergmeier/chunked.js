chunked.js
=========

Polyfill for _chunked_ `XMLHttpRequest` extension proposed by **Mozilla**.

Was started as polyfill for [Streams API](https://dvcs.w3.org/hg/streams-api/raw-file/tip/Overview.htm#stream-interface), but due to the sheer size of the spec, it was reduced to handle just downloading, which is exactly, what Mozilla's extension does.

###Usage:

`XMLHttpRequest.responseType =` < _normal types_ > | `"chunked-text"` | `"chunked-blob"` | `"chunked-arraybuffer";`

Setting one of the `chunked` response types, results in `XMLHttpRequest.response` being only available/set in `progress` events (in contrast to `load` event).
`XMLHttpRequest.response` then contains the data received since the last `progress` event.

###Example:
    <script src="chunked.min.js"></script>
    
    var req = new XMLHttpRequest();
    req.open( "GET", "http://ipv4.download.thinkbroadband.com/512MB.zip" );
    req.responseType = "chunked-array" // alternate `chunked-text` and `chunked-blob`
    req.onload = function( event ) {
    };
    req.onprogress = function( event ) {
        // Access chunk, between last progress call and now
        var chunk = req.result;
        my_incredible_function( chunk );
    };
    req.send();

###Internas:
Wrapper is not derived (`prototype = new XMLHttpRequest()`) from `XMLHttpRequest`, since Javascript forbids this for `DOMElements`.
It wraps `XMLHttpRequest` as well as possible. Be aware that naive `prototype`-checking may fail, though!

