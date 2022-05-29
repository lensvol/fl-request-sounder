(function () {
    const EXTENSION_NAME = "FL Request Sounder";
    const DONE = 4;

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

        const record = {
            method: this._requestMethod,
            url: this._targetUrl,
            timestamp: this._timestamp.getTime(),
            request: structuredClone(this._originalRequest),
            status: response.currentTarget.status,
            response: JSON.parse(response.currentTarget.responseText),
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
