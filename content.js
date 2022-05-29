// Here we inject our code into the context of the page itself, since we need to patch its XHR mechanisms.
var s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
s.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(s);
console.log("[FL Request Sounder] Injecting interceptor...");

let recordingStart = null;
let recordedData = [];

const EXTENSION_NAME = "FL Request Sounder";
function debug(message) {
    console.debug(`[${EXTENSION_NAME}] ${message}`);
}

function jwtReplacer(name, val) {
    if (name === "jwt" || name === "emailAddress") {
        return "<DATA REDACTED>";
    }

    return val;
}

async function saveToFileInFirefox(records) {
    const serializedData = JSON.stringify(records, jwtReplacer, 4)
    chrome.runtime.sendMessage({
        action: "FL_RS_saveInFirefox",
        filename: suggestFileName(recordingStart),
        data: serializedData,
    });

    recordingStart = null;
    recordedData = [];
}

async function saveToFileInChrome(records) {
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

    recordingStart = null;
    recordedData = [];

    return handle;
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

window.addEventListener("FL_RS_recordThat", (event) => {
    if (recordingStart == null) {
        recordingStart = new Date();
        debug(`Recording started on ${recordingStart}`);
    }
    recordedData.push(structuredClone(event.detail));
});

window.addEventListener("FL_RS_finishRecording", (event) => {
    // That is ugly as hell, but who are we kidding? This was never about quality.
    if (typeof browser == "undefined") {
        saveToFileInChrome(recordedData);
    } else {
        saveToFileInFirefox(recordedData);
    }
});
