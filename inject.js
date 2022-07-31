(function () {
    const EXTENSION_NAME = "FL Request Sounder";
    const DONE = 4;

    let previousMessages = null;

    /*
    Taken with alterations from
    https://stackoverflow.com/questions/48728515/deep-compare-javascript-function
    */
    function deepEqual(a, b) {
        if (a && b && typeof a == 'object' && typeof b == 'object') {
            if (Object.keys(a).length !== Object.keys(b).length) return false;
            for (const key in a) {
                // "ago" field is being recomputed each time you make a request
                // to /messages, so straight-up comparison will always fail
                // even on the identical set of messages.
                if (key === "ago") {
                    continue;
                }

                if (!deepEqual(a[key], b[key]))
                    return false;
            }
            return true;
        } else return a === b
    }

    let isRecording = false;
    const recordToggle = createRecordToggleButton();

    function log(message) {
        console.log(`[${EXTENSION_NAME}] ${message}`);
    }

    function debug(message) {
        console.debug(`[${EXTENSION_NAME}] ${message}`);
    }

    function createRecordToggleButton() {
        const button = document.createElement("button");
        button.classList.add("button", "button--primary", "travel-button--infobar");
        button.innerText = "Record";
        return button;
    }

    let travelButtonObserver = new MutationObserver(function (mutations) {
        for (let m = 0; m < mutations.length; m++) {
            const mutation = mutations[m];

            for (let n = 0; n < mutation.addedNodes.length; n++) {
                const node = mutation.addedNodes[n];

                if (node.nodeName !== "DIV") {
                    continue;
                }

                const travelButtons = node.querySelectorAll("button.travel-button--infobar");
                if (travelButtons.length !== 1) {
                    continue;
                }
                const travelButton = travelButtons[0];

                log("Single 'Travel' button found!");

                travelButton.parentNode.insertBefore(recordToggle, travelButton.nextSibling);
                recordToggle.onclick = () => {
                    isRecording = !isRecording;

                    if (isRecording) {
                        recordToggle.innerText = "Recording";
                        recordToggle.classList.add("recording");
                    } else {
                        recordToggle.innerText = "Record";
                        recordToggle.classList.remove("recording");

                        stopRecording();
                    }
                };
            }
        }
    });

    function parseResponse(response) {
        if (this.readyState !== DONE) {
            return;
        }

        if (!isRecording) {
            return;
        }

        const responseJson = JSON.parse(response.currentTarget.responseText);

        if (this._targetUrl.endsWith("/messages")) {
            if (deepEqual(previousMessages, responseJson)) {
                return;
            }

            previousMessages = responseJson;
        }

        const record = {
            method: this._requestMethod,
            url: this._targetUrl,
            timestamp: this._timestamp.getTime(),
            request: structuredClone(this._originalRequest),
            status: response.currentTarget.status,
            response: responseJson,
        }

        appendToRecording(record);
    }

    function appendToRecording(data) {
        const event = new CustomEvent("FL_RS_recordThat", {
            detail: data
        });
        window.dispatchEvent(event);
    }

    function stopRecording() {
        const event = new CustomEvent("FL_RS_finishRecording", {});
        window.dispatchEvent(event);
    }

    function openBypass(original_function) {
        return function (method, url, async) {
            this._requestMethod = method;
            this._targetUrl = url;
            this.addEventListener("readystatechange", parseResponse);
            return original_function.apply(this, arguments);
        };
    }

    function sendBypass(original_function) {
        return function (body) {
            this._originalRequest = arguments[0] ? JSON.parse(arguments[0]) : {};
            this._timestamp = new Date();
            return original_function.apply(this, arguments);
        };
    }

    debug("Setting up API interceptors.");
    XMLHttpRequest.prototype.open = openBypass(XMLHttpRequest.prototype.open);
    XMLHttpRequest.prototype.send = sendBypass(XMLHttpRequest.prototype.send);

    travelButtonObserver.observe(document, {childList: true, subtree: true});
}())
