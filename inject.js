(function () {
    const EXTENSION_NAME = "FL Request Sounder";
    const DONE = 4;

    let isRecording = false;
    let recordingStart = null;
    const recordToggle = createRecordToggleButton();
    let recordedData = [];

    function log(message) {
        console.log(`[${EXTENSION_NAME}] ${message}`);
    }

    function debug(message) {
        console.debug(`[${EXTENSION_NAME}] ${message}`);
    }

    function jwtReplacer(name, val) {
        if (name === "jwt") {
            return "<DATA REDACTED>";
        }

        return val;
    }

    function suggestFileName(startDate) {
        if (startDate == null) {
            return "fallen-london.log";
        }

        const offset = startDate.getTimezoneOffset()
        const tzAwareDate = new Date(startDate.getTime() - (offset*60*1000))
        const month = tzAwareDate.getMonth() + 1;

        const suffix = [
            tzAwareDate.getFullYear(),
            month > 9 ? month : "0" + month,
            tzAwareDate.getDate(),
            tzAwareDate.getHours(),
            tzAwareDate.getMinutes(),
            tzAwareDate.getSeconds()
        ].join("");

        return `fallen-london-${suffix}.log`;
    }

    function createRecordToggleButton() {
        const button = document.createElement("button");
        button.classList.add("button", "button--primary", "travel-button--infobar");
        button.innerText = "Record";
        return button;
    }

    async function saveToFile(records) {
        const options = {
            types: [
                {
                    description: "FL API logs",
                    accept: {
                        "text/plain": [".log"],
                    },
                },
            ],
            suggestedName: suggestFileName(recordingStart),
        };

        const handle = await window.showSaveFilePicker(options);
        const writable = await handle.createWritable();

        await writable.write(JSON.stringify(records, jwtReplacer, 4));
        await writable.close();

        recordedData = [];

        return handle;
    }

    let qualityListObserver = new MutationObserver(function (mutations) {
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

                console.log("[FL Mystery Sorter] Single 'Travel' button found!");

                travelButton.parentNode.insertBefore(recordToggle, travelButton.nextSibling);
                recordToggle.onclick = () => {
                    isRecording = !isRecording;

                    if (isRecording) {
                        recordToggle.innerText = "Recording";
                        recordToggle.classList.add("recording");
                        recordingStart = new Date();
                    } else {
                        if (recordedData.length > 0) {
                            saveToFile(recordedData);
                        }

                        recordToggle.innerText = "Record";
                        recordToggle.classList.remove("recording");
                        recordingStart = null;
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
        recordedData.push(record);
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

    qualityListObserver.observe(document, {childList: true, subtree: true});
}())
