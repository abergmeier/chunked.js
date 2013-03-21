chunked.js
=========

Polyfill for _chunked_ `XMLHttpRequest` extension proposed by **Mozilla**.

Was started as polyfill for [Streams API](https://dvcs.w3.org/hg/streams-api/raw-file/tip/Overview.htm#stream-interface), but due to the sheer size of the spec, it was reduced to handle just downloading, which is exactly, what Mozilla's extension does.

###Scenario:
The main usage for this should be with downloading large files via _http_.
It aims to fix problems like:
* Large files need a long time to download. Currently processing them is only possible after loading has finished. With chunked.js you can start processing as soon as the first *chunk* (_scnr_) was received.
* Large files may result in an Javascript heap overflow. Via _chunked.js_ you can choose to only process a smaller fraction at a time.

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
Does not yet work for _ftp_!

