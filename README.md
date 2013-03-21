chunked.js
=========

Polyfill for _chunked_ `XMLHttpRequest` extension proposed by **Mozilla**.

Was started as polyfill for [Streams API](https://dvcs.w3.org/hg/streams-api/raw-file/tip/Overview.htm#stream-interface), but due to the sheer size of the spec, it was reduced to handle just downloading, which is exactly, what Mozilla's extension does.

###Usage:

`XMLHttpRequest.responseType =` <old values> | `"chunked-text"` | `"chunked-blob"` | `"chunked-arraybuffer";`

Setting one of the `chunked` responseTypes, results in `XMLHttpRequest.response` being only available/set in `progress` events (in contrast to `load` event).
`XMLHttpRequest.response` contains the data received since the last `progress` event.

###Example:

###Interas:

