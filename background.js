chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "FL_RS_saveInFirefox") {
        browser.downloads.download({
            url: URL.createObjectURL(new Blob([request.data], { type: 'text/plain' })),
            saveAs: true,
            filename: request.filename,
        });
    }
});